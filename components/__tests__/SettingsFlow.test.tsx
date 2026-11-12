import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Alert } from 'react-native';
import SettingsScreen from '@/app/settings';
import CinemaSettings from '@/components/cinema/CinemaSettings';

const mockNavigate = jest.fn();
const mockBack = jest.fn();
let mockBeforeRemove: (event: any) => void;
let mockPreventRemove = false;
const mockStack = { dispatch: jest.fn() };
const mockSettings = {
  apiBaseUrl: 'https://saved.example', m3uUrl: '', remoteInputEnabled: false,
  loadSettings: jest.fn(async () => {}), saveSettings: jest.fn(async () => {}),
  setApiBaseUrl: jest.fn((value: string) => { mockSettings.apiBaseUrl = value; }),
  setM3uUrl: jest.fn((value: string) => { mockSettings.m3uUrl = value; }),
  setRemoteInputEnabled: jest.fn((value: boolean) => { mockSettings.remoteInputEnabled = value; }),
};
jest.mock('@/components/cinema/CinemaSettings', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/settings/UpdateSection', () => ({ UpdateSection: () => null }));
jest.mock('@/hooks/useCinemaNavigation', () => ({ useCinemaNavigation: () => ({ onNavigate: mockNavigate, onBack: mockBack }) }));
jest.mock('@react-navigation/native', () => ({ UNSTABLE_usePreventRemove: (prevent: boolean, callback: (event: any) => void) => { mockPreventRemove = prevent; mockBeforeRemove = callback; } }));
jest.mock('expo-router', () => ({ useNavigation: () => mockStack }));
jest.mock('@/stores/settingsStore', () => ({ useSettingsStore: Object.assign(() => mockSettings, { getState: () => mockSettings }) }));
jest.mock('@/stores/remoteControlStore', () => ({ useRemoteControlStore: () => ({ lastMessage: '', targetPage: '', clearMessage: jest.fn() }) }));
jest.mock('@/stores/authStore', () => ({ __esModule: true, default: () => ({ isLoggedIn: false, showLoginModal: jest.fn(), logout: jest.fn() }) }));
let tree: ReactTestRenderer;
const props = () => tree.root.findByType(CinemaSettings).props;
beforeEach(async () => {
  jest.clearAllMocks(); mockSettings.apiBaseUrl = 'https://saved.example'; mockSettings.m3uUrl = ''; mockSettings.remoteInputEnabled = false;
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await act(async () => { tree = create(<SettingsScreen />); });
});
afterEach(() => { act(() => tree.unmount()); jest.restoreAllMocks(); });

test('editing stays local until save commits the draft', async () => {
  act(() => { props().onApiChange('https://new.example'); props().onRemoteChange(true); });
  expect(mockSettings.setApiBaseUrl).not.toHaveBeenCalled();
  expect(mockSettings.setRemoteInputEnabled).not.toHaveBeenCalled();
  expect(props().dirty).toBe(true);
  await act(async () => props().onSave());
  expect(mockSettings.setApiBaseUrl).toHaveBeenCalledWith('https://new.example');
  expect(mockSettings.setRemoteInputEnabled).toHaveBeenCalledWith(true);
  expect(mockSettings.saveSettings).toHaveBeenCalledTimes(1);
  expect(props().dirty).toBe(false);
});

test('navigation asks to discard and retains the persisted configuration', () => {
  act(() => props().onApiChange('https://unsaved.example'));
  act(() => props().onNavigate('home'));
  expect(mockNavigate).not.toHaveBeenCalled();
  const actions = (Alert.alert as jest.Mock).mock.calls.at(-1)[2];
  act(() => actions.find((action: { text: string }) => action.text === '放弃更改').onPress());
  expect(mockSettings.apiBaseUrl).toBe('https://saved.example');
  expect(mockSettings.setApiBaseUrl).not.toHaveBeenCalled();
  expect(mockNavigate).toHaveBeenCalledWith('home');
});

test('stack back is intercepted while a draft is dirty', () => {
  act(() => props().onM3uChange('https://unsaved.example/list.m3u'));
  const event = { preventDefault: jest.fn(), data: { action: { type: 'GO_BACK' } } };
  act(() => mockBeforeRemove(event));
  expect(mockPreventRemove).toBe(true); expect(mockStack.dispatch).not.toHaveBeenCalled();
  const actions = (Alert.alert as jest.Mock).mock.calls.at(-1)[2];
  act(() => actions.find((action: { text: string }) => action.text === '放弃更改').onPress());
  expect(mockStack.dispatch).toHaveBeenCalledWith(event.data.action);
});
