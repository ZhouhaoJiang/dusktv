import React from 'react';
import { useRouter } from 'expo-router';
import CinemaPlayer from '@/components/cinema/CinemaPlayer';
import usePlayerStore from '@/stores/playerStore';
import useDetailStore from '@/stores/detailStore';
import { useSources } from '@/stores/sourceStore';
export const PlayerControls = ({ showControls, setShowControls }: { showControls: boolean; setShowControls: (value: boolean) => void }) => {
  const p = usePlayerStore();
  const { detail } = useDetailStore();
  const sources = useSources();
  const router = useRouter();
  if (!showControls) return null;
  const duration = p.status?.isLoaded ? p.status.durationMillis || 0 : 0;
  const position = p.isSeeking ? p.seekPosition * duration : p.status?.isLoaded ? p.status.positionMillis : 0;
  return <CinemaPlayer title={detail?.title || ''} episode={p.episodes[p.currentEpisodeIndex]?.title} source={sources.find(source => source.source === detail?.source)?.source_name}
    playing={!!(p.status?.isLoaded && p.status.isPlaying)} position={position} duration={duration} rate={p.playbackRate} hasNext={p.currentEpisodeIndex < p.episodes.length - 1} intro={p.introEndTime || 0} outro={p.outroStartTime || 0}
    onBack={() => router.back()} onToggle={p.togglePlayPause} onSeek={p.seek} onNext={() => { if (p.currentEpisodeIndex < p.episodes.length - 1) p.playEpisode(p.currentEpisodeIndex + 1); }}
    onEpisodes={() => p.setShowEpisodeModal(true)} onSources={() => p.setShowSourceModal(true)} onSpeed={() => p.setShowSpeedModal(true)} onIntro={p.setIntroEndTime} onOutro={p.setOutroStartTime} onHide={() => setShowControls(false)} />;
};
