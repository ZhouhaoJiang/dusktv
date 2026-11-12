/* eslint-env browser */
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { I18nProvider } from '@videojs/react/i18n';
import '@videojs/react/i18n/locales/zh-CN/register';
import { VideoPlayer, NeutralVideoSkin, Video } from '@videojs/react/video';
import { HlsJsVideo } from '@videojs/react/media/hlsjs-video';
import '@videojs/react/video/neutral-skin.css';
import './player.css';
import { mediaUrl } from './client-api';

export default forwardRef(function BrowserVideo({ url, loadKey = '', title = '', start = 0, rate = 1, onStatus, onError, onRateChange, onEnded, autoPlay = false, direct = false, children }, ref) {
  const element = useRef(null);
  const [retry, setRetry] = useState(0);
  const [fullscreenError, setFullscreenError] = useState(false);
  useEffect(() => {
    const failed = event => { if (event.target.contains?.(element.current)) setFullscreenError(true); };
    const changed = () => setFullscreenError(false);
    document.addEventListener('fullscreenerror', failed, true);
    document.addEventListener('fullscreenchange', changed);
    return () => { document.removeEventListener('fullscreenerror', failed, true); document.removeEventListener('fullscreenchange', changed); };
  }, []);
  const initial = useRef(start);
  const callbacks = useRef({ onStatus, onError, onRateChange, onEnded });
  callbacks.current = { onStatus, onError, onRateChange, onEnded };
  useImperativeHandle(ref, () => ({
    retry: () => { initial.current = element.current?.currentTime * 1000 || start; setRetry(value => value + 1); },
    restart: position => { initial.current = position; setRetry(value => value + 1); },
    snapshot: () => ({ position: (element.current?.currentTime || 0) * 1000, duration: (element.current?.duration || 0) * 1000 }),
  }), [start]);
  useEffect(() => { initial.current = start; }, [url, start, loadKey]);
  useEffect(() => { if (element.current) element.current.playbackRate = rate; }, [rate, url, retry, loadKey]);
  const report = () => {
    const video = element.current;
    if (video) callbacks.current.onStatus?.({ position: video.currentTime * 1000, duration: Number.isFinite(video.duration) ? video.duration * 1000 : 0, playing: !video.paused && !video.ended });
  };
  const Media = /\.m3u8(?:[?#]|$)/i.test(url || '') ? HlsJsVideo : Video;
  return <I18nProvider locale="zh-CN">
    <VideoPlayer title={title}>
      <NeutralVideoSkin className="dusk-player">
        <Media key={`${loadKey}:${url}:${retry}`} ref={element} src={url ? (direct ? url : mediaUrl(url)) : undefined} playsInline preload="metadata" autoPlay={autoPlay}
          onLoadedMetadata={() => {
            const video = element.current;
            video.playbackRate = rate;
            if (initial.current > 0 && Number.isFinite(video.duration)) video.currentTime = Math.min(initial.current / 1000, Math.max(0, video.duration - 0.1));
            initial.current = 0;
            report();
          }}
          onTimeUpdate={report} onDurationChange={report} onPlay={report} onPause={report}
          onRateChange={() => callbacks.current.onRateChange?.(element.current.playbackRate)}
          onEnded={() => { report(); callbacks.current.onEnded?.(); }}
          onError={() => callbacks.current.onError?.('无法播放此地址，请重试或切换片源。')}
        />
        {children}
        {fullscreenError && <div className="dusk-player-recovery" role="status"><span>浏览器拒绝了全屏请求。请检查站点的全屏权限，或在普通浏览器窗口中打开。</span><button onClick={() => setFullscreenError(false)}>知道了</button></div>}
      </NeutralVideoSkin>
    </VideoPlayer>
  </I18nProvider>;
});
