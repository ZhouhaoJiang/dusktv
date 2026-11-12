import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import Constants from 'expo-constants';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { Platform } from 'react-native';
import { version as packageVersion } from '../package.json';
import { UPDATE_CONFIG } from '../constants/UpdateConfig';

type BuildTarget = 'android' | 'android-tv';
export interface VersionInfo {
  version: string;
  versionCode: number;
  downloadUrl: string;
  sha256: string;
  size: number;
}
interface Release {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  assets: { name: string; browser_download_url: string }[];
}

export function compareVersions(a: string, b: string): number {
  const parse = (value: string) => {
    if (!/^\d+\.\d+\.\d+$/.test(value)) throw new Error('无效的版本号');
    return value.split('.').map(Number);
  };
  const left = parse(a), right = parse(b);
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  }
  return 0;
}

export function parseManifest(data: any, version: string, target: BuildTarget): VersionInfo {
  const [major, minor, patch] = version.split('.').map(Number);
  if (compareVersions(version, version) !== 0 || minor > 999 || patch > 999) throw new Error('无效的版本号');
  const expectedCode = major * 1000000 + minor * 1000 + patch;
  if (data?.schemaVersion !== 1 || data.version !== version || data.versionCode !== expectedCode ||
      !Number.isSafeInteger(expectedCode) || expectedCode < 1 || expectedCode > 2100000000) {
    throw new Error('更新信息无效');
  }
  // Require both targets before announcing a release, even when only one is being installed.
  for (const build of ['android', 'android-tv']) {
    const asset = data.targets?.[build];
    const expectedUrl = `https://github.com/${UPDATE_CONFIG.REPOSITORY}/releases/download/v${version}/dusktv-${build}-v${version}.apk`;
    if (asset?.url !== expectedUrl || !/^[a-f0-9]{64}$/.test(asset.sha256) || !Number.isSafeInteger(asset.size) || asset.size < 1) {
      throw new Error('更新安装包信息不完整');
    }
  }
  const asset = data.targets[target];
  return { version, versionCode: expectedCode, downloadUrl: asset.url, sha256: asset.sha256, size: asset.size };
}

class UpdateService {
  private async fetchJson(url: string): Promise<any> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`检查更新失败（HTTP ${response.status}）`);
      return await response.json();
    } finally { clearTimeout(timer); }
  }

  async checkVersion(): Promise<VersionInfo | null> {
    const releases: Release[] = await this.fetchJson(UPDATE_CONFIG.RELEASES_URL);
    if (!Array.isArray(releases)) throw new Error('更新列表无效');
    const ready = releases.filter(release => {
      if (release.draft || release.prerelease || !/^v\d+\.\d+\.\d+$/.test(release.tag_name)) return false;
      const version = release.tag_name.slice(1);
      return ['update.json', `dusktv-android-v${version}.apk`, `dusktv-android-tv-v${version}.apk`]
        .every(name => release.assets?.some(asset => asset.name === name));
    }).sort((a, b) => compareVersions(b.tag_name.slice(1), a.tag_name.slice(1)));
    if (!ready.length) return null;
    const release = ready[0];
    const url = `https://github.com/${UPDATE_CONFIG.REPOSITORY}/releases/download/${release.tag_name}/update.json`;
    const manifestAsset = release.assets.find(asset => asset.name === 'update.json');
    if (manifestAsset?.browser_download_url !== url) throw new Error('更新来源无效');
    return parseManifest(await this.fetchJson(url), release.tag_name.slice(1), this.getBuildTarget());
  }

  async downloadApk(info: VersionInfo, onProgress?: (percent: number) => void): Promise<string> {
    if (Platform.OS !== 'android' || !FileSystem.cacheDirectory) throw new Error('仅支持 Android 安装更新');
    const fileUri = `${FileSystem.cacheDirectory}DuskTV-update.apk`;
    await FileSystem.deleteAsync(fileUri, { idempotent: true });
    const download = FileSystem.createDownloadResumable(info.downloadUrl, fileUri, {}, progress => {
      if (progress.totalBytesExpectedToWrite > 0) {
        onProgress?.(Math.min(99, Math.floor(progress.totalBytesWritten / progress.totalBytesExpectedToWrite * 100)));
      }
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        download.downloadAsync(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            // Cancel before deleting the partial file, so no writer can recreate it.
            download.pauseAsync().catch(() => undefined).finally(() => reject(new Error('下载超时，请重试')));
          }, UPDATE_CONFIG.DOWNLOAD_TIMEOUT);
        }),
      ]);
      if (!result || result.status !== 200) throw new Error('安装包下载失败');
      const file = await FileSystem.getInfoAsync(fileUri);
      if (!file.exists || file.size !== info.size) throw new Error('安装包大小校验失败，请重新下载');
      const hash = await ReactNativeBlobUtil.fs.hash(fileUri.replace(/^file:\/\//, ''), 'sha256');
      if (hash !== info.sha256) throw new Error('安装包校验失败，请重新下载');
      return fileUri;
    } catch (error) {
      await FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => undefined);
      throw error;
    } finally { if (timer) clearTimeout(timer); }
  }

  async installApk(fileUri: string): Promise<void> {
    if (Platform.OS !== 'android') throw new Error('仅支持 Android 安装更新');
    const file = await FileSystem.getInfoAsync(fileUri);
    if (!file.exists) throw new Error('安装文件已被清理，请重新下载');
    const contentUri = await FileSystem.getContentUriAsync(fileUri);
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        type: 'application/vnd.android.package-archive',
        flags: 0x10000000 | 0x00000001, // NEW_TASK | GRANT_READ_URI_PERMISSION
      });
    } catch {
      throw new Error('无法打开安装器，请在系统设置中允许暮映安装未知应用后重试');
    }
  }

  getBuildTarget(): BuildTarget {
    const target = Constants.expoConfig?.extra?.buildTarget;
    return target === 'android-tv' || (!target && Platform.isTV) ? 'android-tv' : 'android';
  }
  compareVersions = compareVersions;
  getCurrentVersion(): string { return Constants.expoConfig?.version || packageVersion; }
  isUpdateAvailable(version: string): boolean { return compareVersions(version, this.getCurrentVersion()) > 0; }
}
export default new UpdateService();
