import service, { compareVersions, parseManifest } from '../updateService';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import Blob from 'react-native-blob-util';
import Constants from 'expo-constants';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '0.1.0', extra: { buildTarget: 'android' } } } }));
jest.mock('react-native', () => ({ Platform: { OS: 'android', isTV: false } }));
jest.mock('expo-file-system', () => ({ cacheDirectory: 'file:///cache/', deleteAsync: jest.fn().mockResolvedValue(undefined), getInfoAsync: jest.fn(), getContentUriAsync: jest.fn(), createDownloadResumable: jest.fn() }));
jest.mock('expo-intent-launcher', () => ({ startActivityAsync: jest.fn() }));
jest.mock('react-native-blob-util', () => ({ __esModule: true, default: { fs: { hash: jest.fn() } } }));
const sha256 = 'a'.repeat(64);
function manifest(version = '0.2.0') {
  return { schemaVersion: 1, version, versionCode: 2000, targets: Object.fromEntries(['android', 'android-tv'].map(target => [target, {
    url: `https://github.com/ZhouhaoJiang/dusktv/releases/download/v${version}/dusktv-${target}-v${version}.apk`, size: 10, sha256,
  }])) };
}
function release(version = '0.2.0') {
  return { tag_name: `v${version}`, draft: false, prerelease: false, assets: ['update.json', `dusktv-android-v${version}.apk`, `dusktv-android-tv-v${version}.apk`].map(name => ({ name, browser_download_url: `https://github.com/ZhouhaoJiang/dusktv/releases/download/v${version}/${name}` })) };
}
beforeEach(() => { jest.clearAllMocks(); global.fetch = jest.fn(); (Constants.expoConfig!.extra!).buildTarget = 'android'; });
test('selects the built flavor and ignores incomplete, draft and prerelease releases', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => [{ ...release('0.4.0'), assets: [] }, { ...release('0.3.0'), prerelease: true }, { ...release('0.5.0'), draft: true }, release()] }).mockResolvedValueOnce({ ok: true, json: async () => manifest() });
  Constants.expoConfig!.extra!.buildTarget = 'android-tv';
  expect((await service.checkVersion())!.downloadUrl).toContain('dusktv-android-tv-v0.2.0.apk');
});
test('no ready release returns null; API failures do not claim up to date', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => [] });
  expect(await service.checkVersion()).toBeNull();
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 403 });
  await expect(service.checkVersion()).rejects.toThrow('403');
});
test('rejects wrong versions, missing targets, foreign URLs and invalid hashes', () => {
  expect(compareVersions('1.10.0', '1.9.9')).toBe(1);
  for (const edit of [
    (m: any) => { m.version = '0.3.0'; }, (m: any) => { m.versionCode = 1; },
    (m: any) => { delete m.targets['android-tv']; }, (m: any) => { m.targets.android.url = 'https://evil.example/app.apk'; },
    (m: any) => { m.targets.android.sha256 = 'bad'; },
  ]) { const data = manifest(); edit(data); expect(() => parseManifest(data, '0.2.0', 'android')).toThrow(); }
});
test('only returns downloaded APK after HTTP, size and SHA256 checks pass', async () => {
  (FileSystem.createDownloadResumable as jest.Mock).mockReturnValue({ downloadAsync: async () => ({ status: 200 }), pauseAsync: jest.fn() });
  (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 10 });
  (Blob.fs.hash as jest.Mock).mockResolvedValue(sha256);
  const info = parseManifest(manifest(), '0.2.0', 'android');
  expect(await service.downloadApk(info)).toBe('file:///cache/DuskTV-update.apk');
  (Blob.fs.hash as jest.Mock).mockResolvedValue('b'.repeat(64));
  await expect(service.downloadApk(info)).rejects.toThrow('校验失败');
  expect(FileSystem.deleteAsync).toHaveBeenLastCalledWith('file:///cache/DuskTV-update.apk', { idempotent: true });
  (FileSystem.createDownloadResumable as jest.Mock).mockReturnValue({ downloadAsync: async () => ({ status: 404 }) });
  await expect(service.downloadApk(info)).rejects.toThrow('下载失败');
});
test('installation grants read permission and launches the system installer', async () => {
  (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
  (FileSystem.getContentUriAsync as jest.Mock).mockResolvedValue('content://apk');
  await service.installApk('file:///cache/test.apk');
  expect(IntentLauncher.startActivityAsync).toHaveBeenCalledWith('android.intent.action.VIEW', expect.objectContaining({ data: 'content://apk', flags: 0x10000001 }));
});
