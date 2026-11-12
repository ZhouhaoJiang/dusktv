import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { HWEvent } from 'react-native';
import { useTVRemoteHandler } from '../useTVRemoteHandler';

let mockHandler: (event: HWEvent) => void;
const mockPlayer = {
  showControls: false, showEpisodeModal: false, showSourceModal: false, showSpeedModal: false,
  setShowControls: jest.fn(), togglePlayPause: jest.fn(), seek: jest.fn(),
};
jest.mock('react-native', () => ({ useTVEventHandler: (handler: typeof mockHandler) => { mockHandler = handler; } }));
jest.mock('@/stores/playerStore', () => ({ __esModule: true, default: () => mockPlayer }));
function Harness() { useTVRemoteHandler(); return null; }
const press = (eventType: string, eventKeyAction?: number) => act(() => mockHandler({ eventType, eventKeyAction }));

describe('TV player remote', () => {
  let tree: ReactTestRenderer;
  beforeEach(() => {
    jest.useFakeTimers(); jest.clearAllMocks();
    Object.assign(mockPlayer, { showControls: false, showEpisodeModal: false, showSourceModal: false, showSpeedModal: false });
    act(() => { tree = create(<Harness />); });
  });
  afterEach(() => { act(() => tree.unmount()); jest.useRealTimers(); });
  it('handles Android key-up once and accepts action-less TV events', () => {
    press('right', 0); press('right', 1);
    expect(mockPlayer.seek.mock.calls).toEqual([[20000]]);
    press('left'); expect(mockPlayer.seek).toHaveBeenLastCalledWith(-20000);
  });
  it('shows controls and toggles playback once on OK release', () => {
    press('select', 0); press('select', 1);
    expect(mockPlayer.togglePlayPause).toHaveBeenCalledTimes(1);
    expect(mockPlayer.setShowControls).toHaveBeenCalledWith(true);
  });
  it('leaves navigation and OK to focused buttons when controls are visible', () => {
    mockPlayer.showControls = true; act(() => tree.update(<Harness />));
    press('select', 1); press('right', 1);
    expect(mockPlayer.togglePlayPause).not.toHaveBeenCalled();
    expect(mockPlayer.seek).not.toHaveBeenCalled();
    press('playPause', 1); expect(mockPlayer.togglePlayPause).toHaveBeenCalledTimes(1);
  });
  it('does not act behind an open selection modal', () => {
    mockPlayer.showEpisodeModal = true; act(() => tree.update(<Harness />));
    press('select', 1); press('right', 1); press('playPause', 1);
    expect(mockPlayer.togglePlayPause).not.toHaveBeenCalled();
    expect(mockPlayer.seek).not.toHaveBeenCalled();
  });
  it('repeats a held direction and stops on release or unmount', () => {
    press('longRight', 0); act(() => jest.advanceTimersByTime(600));
    expect(mockPlayer.seek).toHaveBeenCalledTimes(3);
    press('longRight', 1); act(() => jest.advanceTimersByTime(600));
    expect(mockPlayer.seek).toHaveBeenCalledTimes(3);
    press('longLeft', 0); act(() => tree.unmount()); act(() => jest.advanceTimersByTime(600));
    expect(mockPlayer.seek).toHaveBeenCalledTimes(3);
  });
});
