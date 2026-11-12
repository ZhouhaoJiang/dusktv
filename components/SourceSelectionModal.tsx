import React from 'react';
import CinemaChoiceDialog from './cinema/CinemaChoiceDialog';
import usePlayerStore from '@/stores/playerStore';
import useDetailStore from '@/stores/detailStore';
export const SourceSelectionModal = () => {
  const p = usePlayerStore();
  const { searchResults, detail, setDetail } = useDetailStore();
  return <CinemaChoiceDialog visible={p.showSourceModal} title="选择播放源" options={searchResults.map((source, index) => ({ value: String(index), label: [source.source_name, source.resolution].filter(Boolean).join(' / ') }))} selected={String(searchResults.findIndex(source => source.source === detail?.source && source.id === detail?.id))} onClose={() => p.setShowSourceModal(false)} onSelect={value => {
    const source = searchResults[Number(value)];
    if (source && (source.source !== detail?.source || source.id !== detail?.id)) {
      setDetail(source);
      p.loadVideo({ source: source.source, id: String(source.id), title: source.title, episodeIndex: Math.min(p.currentEpisodeIndex, Math.max(0, source.episodes.length - 1)), position: p.status?.isLoaded ? p.status.positionMillis : undefined });
    }
    p.setShowSourceModal(false);
  }} />;
};
