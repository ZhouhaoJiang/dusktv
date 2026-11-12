import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import SearchScreen from '@/app/search';
import CinemaSearch from '@/components/cinema/CinemaSearch';
import { api } from '@/services/api';

jest.mock('@/components/cinema/CinemaSearch', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/RemoteControlModal', () => ({ RemoteControlModal: () => null }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/hooks/useCinemaNavigation', () => ({ useCinemaNavigation: () => ({ onNavigate: jest.fn(), onBack: jest.fn() }) }));
jest.mock('@/services/api', () => ({ api: { searchVideos: jest.fn(), getImageProxyUrl: (url: string) => url } }));
jest.mock('@/services/storage', () => ({ SearchHistoryManager: { get: jest.fn(async () => []), add: jest.fn(async () => {}), clear: jest.fn(async () => {}) } }));
jest.mock('@/stores/remoteControlStore', () => ({ useRemoteControlStore: () => ({ showModal: jest.fn(), lastMessage: '', targetPage: '', clearMessage: jest.fn() }) }));
jest.mock('@/stores/settingsStore', () => ({ useSettingsStore: () => ({ remoteInputEnabled: false }) }));

const search = api.searchVideos as jest.Mock;
function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const result = (title: string) => ({ results: [{ id: title, title, source: 'test', poster: '' }] });
let tree: ReactTestRenderer;
const props = () => tree.root.findByType(CinemaSearch).props;
beforeEach(async () => { search.mockReset(); await act(async () => { tree = create(<SearchScreen />); }); });
afterEach(() => act(() => tree.unmount()));

test('a slower previous search cannot overwrite newer results', async () => {
  const first = deferred(), second = deferred();
  search.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  act(() => { void props().onSearch('旧关键词'); });
  act(() => { void props().onSearch('新关键词'); });
  await act(async () => second.resolve(result('新结果')));
  await act(async () => first.resolve(result('旧结果')));
  expect(props().items.map((item: { title: string }) => item.title)).toEqual(['新结果']);
  expect(props().submitted).toBe('新关键词');
  expect(props().loading).toBe(false);
});

test('clearing a pending search keeps the history screen when it resolves', async () => {
  const pending = deferred(); search.mockReturnValue(pending.promise);
  act(() => { void props().onSearch('沙丘'); });
  act(() => props().onClear());
  await act(async () => pending.resolve(result('沙丘')));
  expect(props().submitted).toBe(''); expect(props().items).toEqual([]); expect(props().loading).toBe(false);
});

test('failure and retry never leave stale results on screen', async () => {
  search.mockResolvedValueOnce(result('旧结果')).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ results: [] });
  await act(async () => props().onSearch('旧关键词'));
  await act(async () => props().onSearch('新关键词'));
  expect(props().items).toEqual([]); expect(props().error).toBeTruthy(); expect(props().loading).toBe(false);
  await act(async () => props().onSearch('新关键词'));
  expect(props().items).toEqual([]); expect(props().error).toBeNull();
});
