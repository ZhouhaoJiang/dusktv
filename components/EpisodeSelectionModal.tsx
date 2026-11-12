import React from 'react';
import CinemaChoiceDialog from './cinema/CinemaChoiceDialog';
import usePlayerStore from '@/stores/playerStore';
export const EpisodeSelectionModal = () => {
  const p = usePlayerStore();
  return <CinemaChoiceDialog visible={p.showEpisodeModal} title="选择剧集" options={p.episodes.map((episode, index) => ({ value: String(index), label: episode.title || `第 ${index + 1} 集` }))} selected={String(p.currentEpisodeIndex)} onClose={() => p.setShowEpisodeModal(false)} onSelect={value => { p.playEpisode(Number(value)); p.setShowEpisodeModal(false); }} />;
};
