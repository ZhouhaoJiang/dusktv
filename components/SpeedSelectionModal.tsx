import React from 'react';
import CinemaChoiceDialog from './cinema/CinemaChoiceDialog';
import usePlayerStore from '@/stores/playerStore';
export const SpeedSelectionModal = () => {
  const p = usePlayerStore();
  return <CinemaChoiceDialog visible={p.showSpeedModal} title="播放速度" options={[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(rate => ({ value: String(rate), label: rate === 1 ? '1× 标准' : `${rate}×` }))} selected={String(p.playbackRate)} onClose={() => p.setShowSpeedModal(false)} onSelect={value => { p.setPlaybackRate(Number(value)); p.setShowSpeedModal(false); }} />;
};
