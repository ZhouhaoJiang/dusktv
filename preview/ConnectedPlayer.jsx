/* eslint-env browser */
import React, { useEffect, useRef, useState } from 'react';
import { Dialog } from '@videojs/react';
import { usePlayer } from '@videojs/react/video';
import { ArrowLeft, List, SkipForward, Tv, X, SlidersHorizontal } from 'lucide-react';
import BrowserVideo from './BrowserVideo';

const parse = (episode, index) => {
  const split = episode.indexOf('$');
  return { title: split >= 0 ? episode.slice(0, split) : `第 ${index + 1} 集`, url: split >= 0 ? episode.slice(split + 1) : episode };
};
const clock = milliseconds => {
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};
function PlayerTools({ source, episodeTitle, hasNext, onBack, onNext, onOpen }) {
  const visible = usePlayer(state => state.controlsVisible);
  return <div className="dusk-player-tools" data-visible={visible}>
    <button aria-label="返回影片" onClick={onBack}><ArrowLeft size={20} /></button>
    <span className="dusk-player-subtitle">{episodeTitle} / {source}</span>
    <div className="dusk-player-actions">
      <button disabled={!hasNext} onClick={onNext}><SkipForward size={18} />下一集</button>
      <button onClick={() => onOpen('episodes')}><List size={18} />选集</button>
      <button onClick={() => onOpen('sources')}><Tv size={18} />换源</button>
      <button onClick={() => onOpen('skip')} aria-label="片头片尾设置"><SlidersHorizontal size={18} /></button>
    </div>
  </div>;
}
export default function ConnectedPlayer({ item, sources, initialEpisode = 0, initialPosition = 0, onBack, onRecord, preferences, onPreferences, direct = false }) {
  const video = useRef(null);
  const state = useRef({ position: initialPosition, duration: 0, playing: false });
  const lastSaved = useRef(0), transitioning = useRef(false);
  const [source, setSource] = useState(item), [episode, setEpisode] = useState(initialEpisode), [start, setStart] = useState(initialPosition);
  const [autoPlay, setAutoPlay] = useState(false);
  const [error, setError] = useState(''), [dialog, setDialog] = useState('');
  const [rate, setRate] = useState(preferences.rate || 1), [intro, setIntro] = useState(preferences.intro || 0), [outro, setOutro] = useState(preferences.outro || 0);
  const episodes = source.episodes.map(parse), current = episodes[episode];
  const record = () => { if (state.current.duration > 0) onRecord(source, episode, state.current); };
  const latest = useRef(record); latest.current = record;
  useEffect(() => {
    document.documentElement.setAttribute('data-dusk-playing', '');
    const flush = () => latest.current();
    window.addEventListener('pagehide', flush);
    return () => { document.documentElement.removeAttribute('data-dusk-playing'); flush(); window.removeEventListener('pagehide', flush); };
  }, []);
  useEffect(() => { transitioning.current = false; }, [source, episode]);
  const chooseEpisode = (index, resume = state.current.playing) => {
    if (transitioning.current) return;
    record(); setAutoPlay(resume);
    if (index === episode) { video.current.restart(intro); setDialog(''); return; }
    transitioning.current = true;
    state.current = { position: intro, duration: 0, playing: false };
    setEpisode(index); setStart(intro); setError(''); setDialog('');
  };
  const changeRate = value => {
    if (value === rate) return;
    setRate(value); onPreferences({ rate: value, intro, outro });
  };
  const options = dialog === 'episodes' ? episodes.map((value, index) => ({ value: index, label: value.title })) : sources.map((value, index) => ({ value: index, label: value.sourceName || value.source }));
  const selected = dialog === 'episodes' ? episode : sources.findIndex(value => value.id === source.id && value.source === source.source);
  return <BrowserVideo ref={video} loadKey={`${source.source}:${source.id}:${episode}`} autoPlay={autoPlay} url={current?.url} title={source.title} start={start} rate={rate} direct={direct}
    onRateChange={changeRate} onError={setError}
    onEnded={() => { record(); if (episode < episodes.length - 1) chooseEpisode(episode + 1, true); }}
    onStatus={value => {
      state.current = value;
      if (Date.now() - lastSaved.current > 15000 && value.duration > 0 && value.position > 0) { lastSaved.current = Date.now(); record(); }
      if (outro > 0 && value.playing && value.position >= outro && episode < episodes.length - 1) chooseEpisode(episode + 1);
    }}>
    <PlayerTools source={source.sourceName || source.source} episodeTitle={current?.title} hasNext={episode < episodes.length - 1}
      onBack={() => { record(); onBack(); }} onNext={() => chooseEpisode(episode + 1)} onOpen={setDialog} />
    <Dialog.Root open={!!dialog} onOpenChange={open => { if (!open) setDialog(''); }}>
      <Dialog.Backdrop className="dusk-player-backdrop" />
      <Dialog.Popup className="dusk-player-dialog">
        <div className="dusk-player-dialog-heading"><Dialog.Title>{{ episodes: '选择剧集', sources: '选择播放源', skip: '片头片尾设置' }[dialog]}</Dialog.Title><Dialog.Close aria-label="关闭"><X size={22} /></Dialog.Close></div>
        {dialog === 'skip' ? <div className="dusk-player-options">
          <p>在对应位置暂停后，设置片头结束或片尾开始时间。</p>
          <button onClick={() => { const value = intro ? 0 : state.current.position; setIntro(value); onPreferences({ rate, intro: value, outro }); }}>{intro ? `清除片头 ${clock(intro)}` : '设为片头结束'}</button>
          <button onClick={() => { const value = outro ? 0 : state.current.position; setOutro(value); onPreferences({ rate, intro, outro: value }); }}>{outro ? `清除片尾 ${clock(outro)}` : '设为片尾开始'}</button>
        </div> : <div className="dusk-player-options">{options.map(option => <button key={option.value} aria-pressed={option.value === selected} onClick={() => {
          if (dialog === 'episodes') chooseEpisode(option.value);
          else {
            record(); const next = sources[option.value];
            setStart(state.current.position); setSource(next); setEpisode(Math.min(episode, Math.max(0, next.episodes.length - 1))); setError(''); setDialog('');
          }
        }}>{option.label}</button>)}</div>}
      </Dialog.Popup>
    </Dialog.Root>
    {!!error && <div className="dusk-player-recovery" role="status"><span>{error}</span><button onClick={() => { setError(''); video.current.retry(); }}>重试播放</button><button onClick={() => setDialog('sources')}>选择其他片源</button></div>}
  </BrowserVideo>;
}
