import { useUpdateStore, initUpdateStore } from '../updateStore';
import service, { ApkMissingError } from '../../services/updateService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
jest.mock('../../services/updateService', () => ({ __esModule: true, ApkMissingError: class extends Error {}, default: { getCurrentVersion: () => '0.1.0', checkVersion: jest.fn(), isUpdateAvailable: () => true, downloadApk: jest.fn(), installApk: jest.fn() } }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn().mockResolvedValue(undefined) }));
jest.mock('react-native-toast-message', () => ({ show: jest.fn() }));
const info = { version: '0.2.0', versionCode: 2000, downloadUrl: 'url', sha256: 'hash', size: 10 };
const initial = useUpdateStore.getState();
beforeEach(() => { jest.clearAllMocks(); useUpdateStore.setState(initial, true); (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null); (service.checkVersion as jest.Mock).mockResolvedValue(info); });
test('automatic checks announce updates but honor skipped versions; manual checks override skipping', async () => {
  await useUpdateStore.getState().checkForUpdate(true);
  expect(useUpdateStore.getState().showUpdateModal).toBe(true);
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue('0.2.0');
  await useUpdateStore.getState().checkForUpdate(true);
  expect(useUpdateStore.getState().showUpdateModal).toBe(false);
  await useUpdateStore.getState().checkForUpdate(false);
  expect(useUpdateStore.getState().showUpdateModal).toBe(true);
});
test('silent errors are quiet and record an attempt time to prevent loops', async () => {
  (service.checkVersion as jest.Mock).mockRejectedValue(new Error('offline'));
  await useUpdateStore.getState().checkForUpdate(true);
  expect(Toast.show).not.toHaveBeenCalled();
  expect(useUpdateStore.getState().lastCheckTime).toBeGreaterThan(0);
  expect(useUpdateStore.getState().isLatestVersion).toBe(false);
  await useUpdateStore.getState().checkForUpdate(false);
  expect(useUpdateStore.getState().error).toBe('offline');
});
test('a new release invalidates a previously downloaded APK', async () => {
  useUpdateStore.setState({ remoteVersion: '0.1.1', downloadedPath: 'old.apk' });
  await useUpdateStore.getState().checkForUpdate();
  expect(useUpdateStore.getState().downloadedPath).toBeNull();
});
test('duplicate checks are suppressed while downloading', async () => {
  useUpdateStore.setState({ downloading: true });
  await useUpdateStore.getState().checkForUpdate();
  expect(service.checkVersion).not.toHaveBeenCalled();
});
test('initialization completes even when storage fails', async () => {
  (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('storage'));
  await expect(initUpdateStore()).rejects.toThrow('storage');
  expect(useUpdateStore.getState().initialized).toBe(true);
});

test('cache eviction allows a fresh download while install permission errors retain the APK', async () => {
  useUpdateStore.setState({ downloadedPath: 'cached.apk' });
  (service.installApk as jest.Mock).mockRejectedValueOnce(new Error('permission'));
  await useUpdateStore.getState().installUpdate();
  expect(useUpdateStore.getState().downloadedPath).toBe('cached.apk');
  (service.installApk as jest.Mock).mockRejectedValueOnce(new ApkMissingError('missing'));
  await useUpdateStore.getState().installUpdate();
  expect(useUpdateStore.getState().downloadedPath).toBeNull();
});
