/* eslint-env browser */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import CinemaPlayer from '../components/cinema/CinemaPlayer';
import CinemaChoiceDialog from '../components/cinema/CinemaChoiceDialog';
import { CinemaButton } from '../components/cinema/CinemaUI';
import BrowserVideo from './BrowserVideo';
const parse = (episode, index) => { const split=episode.indexOf('$'); return { title:split>=0?episode.slice(0,split):`第 ${index+1} 集`, url:split>=0?episode.slice(split+1):episode }; };
export default function ConnectedPlayer({ item, sources, initialEpisode = 0, initialPosition = 0, onBack, onRecord, preferences, onPreferences }) {
  const video=useRef(null), state=useRef({position:initialPosition,duration:0,playing:false}), lastSaved=useRef(0), saveRecord=useRef(onRecord);
  const [source,setSource]=useState(item), [episode,setEpisode]=useState(initialEpisode), [start,setStart]=useState(initialPosition);
  const [status,setStatus]=useState(state.current), [error,setError]=useState(''), [dialog,setDialog]=useState(''), [controls,setControls]=useState(true);
  const [rate,setRate]=useState(preferences.rate||1), [intro,setIntro]=useState(preferences.intro||0), [outro,setOutro]=useState(preferences.outro||0);
  const episodes=source.episodes.map(parse), current=episodes[episode];
  saveRecord.current=onRecord;
  const record=()=> { const current=state.current; if(current.duration>0) saveRecord.current(source,episode,current); };
  const latest=useRef(record); latest.current=record;
  useEffect(()=> { const flush=()=>latest.current(); window.addEventListener('pagehide',flush); return()=>{flush(); window.removeEventListener('pagehide',flush);}; },[]);
  const chooseEpisode=index=> { record(); setEpisode(index); setStart(intro); setError(''); setDialog(''); };
  const options=dialog==='episodes'?episodes.map((value,index)=>({value:String(index),label:value.title})):dialog==='speed'?[0.5,0.75,1,1.25,1.5,1.75,2].map(value=>({value:String(value),label:`${value}×` })):sources.map((value,index)=>({value:String(index),label:value.sourceName||value.source}));
  return <View style={{flex:1,backgroundColor:'#000'}}>
    <BrowserVideo key={`${source.source}:${source.id}:${episode}`} ref={video} url={current?.url} start={start} rate={rate} onError={setError} onEnded={()=>{record(); if(episode<episodes.length-1) chooseEpisode(episode+1);}} onStatus={value=>{
      state.current=value; setStatus(value);
      if(Date.now()-lastSaved.current>15000 && value.duration>0 && value.position>0) {lastSaved.current=Date.now(); record();}
      if(outro>0 && value.playing && value.position>=outro && episode<episodes.length-1) chooseEpisode(episode+1);
    }} />
    {controls?<CinemaPlayer title={source.title} episode={current?.title} source={source.sourceName} playing={status.playing} position={status.position} duration={status.duration} rate={rate} hasNext={episode<episodes.length-1} intro={intro} outro={outro}
      onBack={()=>{record();onBack();}} onToggle={()=>video.current.toggle().catch(()=>setError('浏览器未能开始播放，请重试或切换片源。'))} onSeek={value=>video.current.seek(value)} onNext={()=>chooseEpisode(episode+1)} onEpisodes={()=>setDialog('episodes')} onSources={()=>setDialog('sources')} onSpeed={()=>setDialog('speed')} onIntro={()=>{const value=intro?0:status.position;setIntro(value);onPreferences({rate,intro:value,outro});}} onOutro={()=>{const value=outro?0:status.position;setOutro(value);onPreferences({rate,intro,outro:value});}} onHide={()=>setControls(false)} />:<View style={{position:'absolute',bottom:25,alignSelf:'center'}}><CinemaButton label="显示控制栏" primary onPress={()=>setControls(true)} /></View>}
    {!!error&&<View style={{position:'absolute',top:'30%',alignSelf:'center',maxWidth:'90%',padding:24,gap:16,backgroundColor:'#202427',borderRadius:18}}><Text style={{color:'#f5f6f7',fontSize:17}}>{error}</Text><View style={{flexDirection:'row',gap:12}}><CinemaButton label="重试播放" primary onPress={()=>{setError('');video.current.retry();}}/><CinemaButton label="选择其他片源" onPress={()=>setDialog('sources')}/></View></View>}
    <CinemaChoiceDialog visible={!!dialog} title={{episodes:'选择剧集',speed:'播放速度',sources:'选择播放源'}[dialog]||''} options={options} selected={dialog==='episodes'?String(episode):dialog==='speed'?String(rate):String(sources.findIndex(value=>value.id===source.id&&value.source===source.source))} onClose={()=>setDialog('')} onSelect={value=>{if(dialog==='episodes')chooseEpisode(Number(value));else if(dialog==='speed'){setRate(Number(value));onPreferences({rate:Number(value),intro,outro});}else{record();const next=sources[Number(value)];setStart(status.position);setSource(next);setEpisode(Math.min(episode,Math.max(0,next.episodes.length-1)));setError('');}setDialog('');}}/>
  </View>;
}
