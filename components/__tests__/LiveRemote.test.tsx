import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { useTVEventHandler } from 'react-native';
import LiveScreen from '@/app/live';
import CinemaLive from '@/components/cinema/CinemaLive';

jest.mock('react-native', () => ({
  useTVEventHandler: jest.fn(),
  BackHandler: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
}));
jest.mock('@/components/cinema/CinemaLive', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/LivePlayer', () => ({ __esModule: true, default: () => null }));
jest.mock('@/hooks/useCinemaNavigation', () => ({ useCinemaNavigation: () => ({ onNavigate: jest.fn(), onBack: jest.fn() }) }));
jest.mock('@/stores/settingsStore', () => ({ useSettingsStore: () => ({ m3uUrl: 'https://example.test/channels.m3u' }) }));
jest.mock('@/services/m3u', () => ({
  fetchAndParseM3u: jest.fn(async () => [
    { id: 'one', name: '频道一', url: 'https://example.test/one.m3u8', logo: '', group: '测试' },
    { id: 'two', name: '频道二', url: 'https://example.test/two.m3u8', logo: '', group: '测试' },
    { id: 'three', name: '频道三', url: 'https://example.test/three.m3u8', logo: '', group: '测试' },
  ]),
  getPlayableUrl: (url: string | null) => url,
}));

let tree: ReactTestRenderer;
const props = () => tree.root.findByType(CinemaLive).props;
const press = (eventType: string, eventKeyAction?: number) => act(() => {
  const calls = (useTVEventHandler as jest.Mock).mock.calls;
  calls[calls.length - 1][0]({ eventType, eventKeyAction });
});

beforeEach(async () => {
  jest.clearAllMocks();
  await act(async () => { tree = create(<LiveScreen />); });
  expect(props().selectedId).toBe('one');
  act(() => props().onFullscreen(true));
});
afterEach(() => act(() => tree.unmount()));

test('Android TV ACTION_UP changes channels in fullscreen and wraps at both ends', () => {
  press('left', 1);
  expect(props().selectedId).toBe('three');
  press('right', 1);
  expect(props().selectedId).toBe('one');
  press('right', 1);
  expect(props().selectedId).toBe('two');
});

test('ACTION_DOWN is ignored so a down/up pair only performs one action', () => {
  press('right', 0);
  press('left', 0);
  press('down', 0);
  expect(props().selectedId).toBe('one');
  expect(props().fullscreen).toBe(true);
  press('right', 1);
  expect(props().selectedId).toBe('two');
});

test('down ACTION_UP exits fullscreen; channel-list navigation does not switch playback', () => {
  press('down', 1);
  expect(props().fullscreen).toBe(false);
  press('left', 1);
  press('right', 1);
  expect(props().selectedId).toBe('one');
});

test('platforms without eventKeyAction still support fullscreen remote navigation', () => {
  press('right');
  expect(props().selectedId).toBe('two');
  press('down');
  expect(props().fullscreen).toBe(false);
});
