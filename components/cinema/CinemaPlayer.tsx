import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, ArrowDownToDot, ArrowUpFromDot, EyeOff, Gauge, List, Pause, Play, RotateCcw, RotateCw, SkipForward, Tv } from 'lucide-react-native';
import { cinema as c } from '@/constants/CinemaTheme';
import { CinemaButton, useCinemaLayout } from './CinemaUI';
export function formatPlaybackTime(milliseconds: number) {
  const seconds = Math.floor(Math.max(0, Number.isFinite(milliseconds) ? milliseconds : 0) / 1000);
  const hours = Math.floor(seconds / 3600);
  return [hours > 0 ? hours : undefined, Math.floor(seconds / 60) % 60, seconds % 60].filter(value => value !== undefined).map(value => String(value).padStart(2, '0')).join(':');
}
export interface CinemaPlayerProps {
  title: string; episode?: string; source?: string; playing: boolean; position: number; duration: number; rate: number; hasNext: boolean; intro: number; outro: number;
  onBack: () => void; onToggle: () => void; onNext: () => void; onSeek: (delta: number) => void; onEpisodes: () => void; onSources: () => void; onSpeed: () => void; onIntro: () => void; onOutro: () => void; onHide: () => void;
}
export default function CinemaPlayer(p: CinemaPlayerProps) {
  const { scale, gutter, compact } = useCinemaLayout();
  const progress = p.duration > 0 ? Math.min(1, Math.max(0, p.position / p.duration)) : 0;
  return <View style={[StyleSheet.absoluteFill, { justifyContent: 'space-between' }]} pointerEvents="box-none">
    <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0.88)', 'rgba(0,0,0,0)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '35%' }} />
    <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.96)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '58%' }} />
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: gutter, paddingTop: 20 * scale, gap: 18 }}>
      <CinemaButton label="返回影片" icon={ArrowLeft} compact onPress={p.onBack} scale={scale} /><View style={{ flex: 1, gap: 5 }}><Text numberOfLines={1} style={{ color: c.text, fontSize: 22 * scale, fontWeight: '600' }}>{p.title}</Text><Text style={{ color: c.secondary, fontSize: 14 * scale }}>{[p.episode, p.source].filter(Boolean).join(' / ')}</Text></View><CinemaButton label="隐藏控制栏" icon={EyeOff} compact onPress={p.onHide} scale={scale} />
    </View>
    <View style={{ paddingHorizontal: gutter, paddingBottom: 22 * scale, gap: 14 * scale }}>
      <View accessibilityRole="progressbar" accessibilityLabel="播放进度" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }} style={{ height: 4 * scale, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.24)' }}><View style={{ height: '100%', width: `${progress * 100}%`, backgroundColor: c.accent, borderRadius: 8 }} /></View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: c.text, fontSize: 14 * scale }}>{formatPlaybackTime(p.position)}</Text><Text style={{ color: c.secondary, fontSize: 14 * scale }}>{formatPlaybackTime(p.duration)}</Text></View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 14 }}>
        <View style={{ flexDirection: 'row', maxWidth: '100%', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}><CinemaButton label="快退 20 秒" icon={RotateCcw} compact onPress={() => p.onSeek(-20000)} scale={scale} /><CinemaButton label={p.playing ? '暂停' : '播放'} icon={p.playing ? Pause : Play} primary preferred onPress={p.onToggle} scale={scale} /><CinemaButton label="快进 20 秒" icon={RotateCw} compact onPress={() => p.onSeek(20000)} scale={scale} /><CinemaButton label="下一集" icon={SkipForward} compact={compact} disabled={!p.hasNext} onPress={p.onNext} scale={scale} /></View>
        <View style={{ flexDirection: 'row', maxWidth: '100%', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}><CinemaButton label="选集" icon={List} onPress={p.onEpisodes} scale={scale} /><CinemaButton label={`${p.rate}× 倍速`} icon={Gauge} onPress={p.onSpeed} scale={scale} /><CinemaButton label="换源" icon={Tv} onPress={p.onSources} scale={scale} /></View>
      </View>
      <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}><CinemaButton label={p.intro ? `片头 ${formatPlaybackTime(p.intro)}` : '设为片头结束'} icon={ArrowDownToDot} selected={!!p.intro} onPress={p.onIntro} scale={scale * 0.85} /><CinemaButton label={p.outro ? `片尾 ${formatPlaybackTime(p.outro)}` : '设为片尾开始'} icon={ArrowUpFromDot} selected={!!p.outro} onPress={p.onOutro} scale={scale * 0.85} /></View>
    </View>
  </View>;
}
