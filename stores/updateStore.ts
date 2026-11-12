import { create } from 'zustand';
import updateService, { ApkMissingError, VersionInfo } from '../services/updateService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';

interface UpdateState {
  initialized: boolean;
  checking: boolean;
  updateAvailable: boolean;
  currentVersion: string;
  remoteVersion: string;
  downloadUrl: string;
  versionInfo: VersionInfo | null;
  downloading: boolean;
  downloadProgress: number;
  downloadedPath: string | null;
  error: string | null;
  lastCheckTime: number;
  skipVersion: string | null;
  showUpdateModal: boolean;
  isLatestVersion: boolean;
  checkForUpdate: (silent?: boolean) => Promise<void>;
  startDownload: () => Promise<void>;
  installUpdate: () => Promise<void>;
  setShowUpdateModal: (show: boolean) => void;
  skipThisVersion: () => Promise<void>;
  reset: () => void;
}
const STORAGE_KEYS = { LAST_CHECK_TIME: 'update_last_check_time', SKIP_VERSION: 'update_skip_version' };

export const useUpdateStore = create<UpdateState>((set, get) => ({
  initialized: false,
  checking: false,
  updateAvailable: false,
  currentVersion: updateService.getCurrentVersion(),
  remoteVersion: '',
  downloadUrl: '',
  versionInfo: null,
  downloading: false,
  downloadProgress: 0,
  downloadedPath: null,
  error: null,
  lastCheckTime: 0,
  skipVersion: null,
  showUpdateModal: false,
  isLatestVersion: false,

  checkForUpdate: async (silent = false) => {
    if (get().checking || get().downloading) return;
    const now = Date.now();
    set({ checking: true, error: null, isLatestVersion: false, lastCheckTime: now });
    try {
      const skipVersion = await AsyncStorage.getItem(STORAGE_KEYS.SKIP_VERSION);
      const info = await updateService.checkVersion();
      const available = !!info && updateService.isUpdateAvailable(info.version);
      const changed = get().versionInfo?.sha256 !== info?.sha256 || get().remoteVersion !== info?.version;
      set({
        versionInfo: info,
        remoteVersion: info?.version || '',
        downloadUrl: info?.downloadUrl || '',
        updateAvailable: available,
        skipVersion,
        // Automatic checks suppress errors, but announce a new, non-skipped version.
        // A manual check always allows a previously skipped version to be installed.
        showUpdateModal: available && (!silent || info?.version !== skipVersion),
        isLatestVersion: !available,
        ...(changed ? { downloadedPath: null, downloadProgress: 0 } : {}),
      });
      if (!silent && !available) Toast.show({ type: 'success', text1: '暂无可用更新', text2: `当前版本 v${get().currentVersion}` });
    } catch (error) {
      const message = error instanceof Error ? error.message : '检查更新失败';
      set({ error: silent ? null : message, isLatestVersion: false });
      if (!silent) Toast.show({ type: 'error', text1: '检查更新失败', text2: message });
    } finally {
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_CHECK_TIME, String(now)).catch(() => undefined);
      set({ checking: false });
    }
  },

  startDownload: async () => {
    const { versionInfo, downloading, checking } = get();
    if (downloading || checking) return;
    if (!versionInfo || !get().updateAvailable) { set({ error: '请先检查更新' }); return; }
    set({ downloading: true, downloadedPath: null, downloadProgress: 0, error: null });
    try {
      const filePath = await updateService.downloadApk(versionInfo, progress => set({ downloadProgress: progress }));
      set({ downloadedPath: filePath, downloading: false, downloadProgress: 100 });
    } catch (error) {
      set({ downloading: false, downloadProgress: 0, error: error instanceof Error ? error.message : '下载失败' });
    }
  },
  installUpdate: async () => {
    const { downloadedPath } = get();
    if (!downloadedPath) { set({ error: '请先下载安装包' }); return; }
    try {
      set({ error: null });
      await updateService.installApk(downloadedPath);
      set({ showUpdateModal: false });
    } catch (error) {
      // Keep the verified APK so permission errors can be retried without downloading again.
      set({ error: error instanceof Error ? error.message : '安装失败', ...(error instanceof ApkMissingError ? { downloadedPath: null, downloadProgress: 0 } : {}) });
    }
  },
  setShowUpdateModal: show => set({ showUpdateModal: show }),
  skipThisVersion: async () => {
    const { remoteVersion } = get();
    if (!remoteVersion) return;
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SKIP_VERSION, remoteVersion);
      set({ skipVersion: remoteVersion, showUpdateModal: false });
    } catch { set({ error: '无法保存跳过版本设置，请重试' }); }
  },
  reset: () => {
    if (get().downloading) return;
    set({ downloadProgress: 0, downloadedPath: null, error: null, showUpdateModal: false, isLatestVersion: false });
  },
}));

export const initUpdateStore = async () => {
  try {
    const [lastCheckTime, skipVersion] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.LAST_CHECK_TIME), AsyncStorage.getItem(STORAGE_KEYS.SKIP_VERSION),
    ]);
    const timestamp = Number(lastCheckTime);
    useUpdateStore.setState({ lastCheckTime: Number.isFinite(timestamp) && timestamp <= Date.now() ? timestamp : 0, skipVersion });
  } finally { useUpdateStore.setState({ initialized: true }); }
};
