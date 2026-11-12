/* eslint-env browser */
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import Hls from 'hls.js';
import { mediaUrl } from './client-api';

export default forwardRef(function BrowserVideo({ url, start = 0, rate = 1, onStatus = () => {}, onError = () => {}, controls = false, onEnded, autoPlay = false }, ref) {
  const element = useRef(null), status = useRef(onStatus), reportError = useRef(onError), initial = useRef(start);
  status.current = onStatus; reportError.current = onError;
  const [retry, setRetry] = useState(0);
  useImperativeHandle(ref, () => ({
    toggle: async () => { const v=element.current; if(v.paused) await v.play(); else v.pause(); },
    seek: delta => { const v=element.current; if(Number.isFinite(v.duration)) v.currentTime=Math.max(0,Math.min(v.duration,v.currentTime+delta/1000)); },
    retry: () => setRetry(value=>value+1),
    snapshot: () => ({ position: element.current.currentTime*1000, duration: element.current.duration*1000 }),
  }), []);
  useEffect(() => { element.current.playbackRate = rate; }, [rate]);
  useEffect(() => {
    const video = element.current;
    if (!url) return;
    initial.current = start;
    let hls, disposed = false;
    const report = () => status.current({ position: video.currentTime*1000, duration: Number.isFinite(video.duration)?video.duration*1000:0, playing: !video.paused && !video.ended });
    const loaded = () => { if(initial.current>0 && Number.isFinite(video.duration)) video.currentTime=Math.min(initial.current/1000,Math.max(0,video.duration-1)); initial.current=0; if(autoPlay) video.play().catch(()=>{}); report(); };
    const failed = () => { if(!disposed) reportError.current('无法播放此地址，请重试或切换片源。'); };
    for(const event of ['play','pause','timeupdate','durationchange']) video.addEventListener(event,report);
    video.addEventListener('loadedmetadata',loaded); video.addEventListener('error',failed);
    const source = mediaUrl(url);
    if (/\.m3u8(?:[?#]|$)/i.test(url) && Hls.isSupported()) {
      hls = new Hls({ maxBufferLength: 30 });
      hls.on(Hls.Events.ERROR, (_, data) => { if(data.fatal) failed(); });
      hls.loadSource(source); hls.attachMedia(video);
    } else { video.src=source; video.load(); }
    return () => { disposed=true; for(const event of ['play','pause','timeupdate','durationchange']) video.removeEventListener(event,report); video.removeEventListener('loadedmetadata',loaded); video.removeEventListener('error',failed); hls?.destroy(); video.pause(); video.removeAttribute('src'); video.load(); };
  }, [url, retry, start, autoPlay]);
  return <video ref={element} playsInline controls={controls} onEnded={onEnded} preload="metadata" style={{ width:'100%', height:'100%', objectFit:'contain', background:'#000' }} />;
});
