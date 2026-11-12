/* eslint-env browser */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import CinemaHome from '../components/home/CinemaHome';
import CinemaSearch from '../components/cinema/CinemaSearch';
import CinemaDetail from '../components/cinema/CinemaDetail';
import CinemaLibrary from '../components/cinema/CinemaLibrary';
import CinemaSettings from '../components/cinema/CinemaSettings';
import CinemaLive from '../components/cinema/CinemaLive';
import CinemaLogin from '../components/cinema/CinemaLogin';
import { CinemaButton, CinemaDialog, CinemaShell, CinemaState } from '../components/cinema/CinemaUI';
import ConnectedPlayer from './ConnectedPlayer';
import BrowserVideo from './BrowserVideo';
import { usePreviewKeyboard } from './DemoApp';
import { categories } from './fixtures';
import { request, imageUrl, mediaUrl, saved, save, present, fromStored, itemKey, parseChannels } from './client-api';

const initialSettings = () => saved('settings', { api:'', m3u:'' });
const routeNow = () => location.hash.slice(1) || 'home';
const emptyDetail = { key:'', items:[], selected:null, loading:false, error:null };
export default function ConnectedApp() {
  usePreviewKeyboard();
  const [route,setRoute]=useState(routeNow), [settings,setSettings]=useState(initialSettings), [draft,setDraft]=useState(initialSettings);
  const [config,setConfig]=useState(null), [connecting,setConnecting]=useState(true), [connectionError,setConnectionError]=useState(''), [loggedIn,setLoggedIn]=useState(false);
  const [loginVisible,setLoginVisible]=useState(false), [username,setUsername]=useState(''), [password,setPassword]=useState(''), [loginError,setLoginError]=useState(''), [loggingIn,setLoggingIn]=useState(false);
  const [dirty,setDirty]=useState(false), [notice,setNotice]=useState(''), [confirm,setConfirm]=useState(null), [refresh,setRefresh]=useState(0);
  const [keyword,setKeyword]=useState(''), [submitted,setSubmitted]=useState(''), [history,setHistory]=useState([]), [results,setResults]=useState([]), [searching,setSearching]=useState(false), [searchError,setSearchError]=useState(null);
  const [favorites,setFavorites]=useState({}), [records,setRecords]=useState({}), [libraryLoading,setLibraryLoading]=useState(false), [libraryError,setLibraryError]=useState(null), [favoriteBusy,setFavoriteBusy]=useState(false);
  const [category,setCategory]=useState(categories[0]), [homeItems,setHomeItems]=useState([]), [homeLoading,setHomeLoading]=useState(false), [homeError,setHomeError]=useState(null), [loadingMore,setLoadingMore]=useState(false), [hasMore,setHasMore]=useState(true);
  const [detail,setDetail]=useState(emptyDetail), [detailRetry,setDetailRetry]=useState(0);
  const [channels,setChannels]=useState([]), [channelId,setChannelId]=useState(''), [group,setGroup]=useState(''), [liveLoading,setLiveLoading]=useState(false), [liveError,setLiveError]=useState(''), [fullscreen,setFullscreen]=useState(false);
  const searchRequest=useRef(0), homeRequest=useRef(0), detailRequest=useRef(0), connectionRequest=useRef(0);
  const dirtyRef=useRef(dirty); dirtyRef.current=dirty;
  const [routePath,routeQuery='']=route.split('?');
  const [page,titleEncoded,sourceEncoded,idEncoded]=routePath.split('/');
  const title=decodeURIComponent(titleEncoded||''), preferredSource=decodeURIComponent(sourceEncoded||''), preferredId=decodeURIComponent(idEncoded||'');
  const routeParams=new URLSearchParams(routeQuery);
  const detailKey=['detail','play'].includes(page)?`${title}|${preferredSource}|${preferredId}`:'';
  const localOnly=config?.StorageType==='localstorage';
  const scope=encodeURIComponent(settings.api);
  const storageKey=useCallback(name=>`${scope}-${name}`,[scope]);
  const loadCollection=useCallback(async name=>localOnly?saved(storageKey(name),{}):request(`/api/${name}`),[localOnly,storageKey]);
  const writeCollection=async(name,key,value)=>{
    if(localOnly){const values=saved(storageKey(name),{});if(value===null)delete values[key];else values[key]={...value,save_time:Date.now()};save(storageKey(name),values);return values;}
    await request(`/api/${name}${value===null?`?key=${encodeURIComponent(key)}`:''}`,{method:value===null?'DELETE':'POST',body:value===null?undefined:{key,[name==='favorites'?'favorite':'record']:value}});
    return request(`/api/${name}`);
  };
  useEffect(()=>{
    if(!window.history.state?.duskLive)window.history.replaceState({duskLive:true,index:0},'',location.href);
    const changed=()=>{setRoute(routeNow());setFullscreen(false);};
    const expired=()=>{setLoggedIn(false);setLoginError('登录已失效，请重新登录。');setLoginVisible(true);setFavorites({});setRecords({});setResults([]);};
    const beforeUnload=e=>{if(dirtyRef.current){e.preventDefault();e.returnValue='';}};
    window.addEventListener('hashchange',changed);window.addEventListener('popstate',changed);window.addEventListener('dusk-session-expired',expired);window.addEventListener('beforeunload',beforeUnload);
    return()=>{window.removeEventListener('hashchange',changed);window.removeEventListener('popstate',changed);window.removeEventListener('dusk-session-expired',expired);window.removeEventListener('beforeunload',beforeUnload);};
  },[]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),4500);return()=>clearTimeout(timer);},[notice]);
  const leave=action=>{if(page==='settings'&&dirty)setConfirm({title:'设置尚未保存',message:'离开后将放弃未保存的更改。',action:()=>{setDraft(settings);setDirty(false);action();}});else action();};
  const go=next=>leave(()=>{window.history.pushState({duskLive:true,index:(window.history.state?.index||0)+1},'',`#${next}`);setRoute(next);setFullscreen(false);});
  const back=()=>leave(()=>{if(window.history.state?.index>0)window.history.back();else{window.history.replaceState({duskLive:true,index:0},'','#home');setRoute('home');}});
  const nav={onNavigate:go,onBack:back};

  const connect=useCallback(async (values, { openLogin=true }={})=>{
    const token=++connectionRequest.current;
    setConnecting(true);setConnectionError('');
    try{
      const result=await request('/connect',{method:'POST',body:{baseURL:values.api.trim()}});
      if(token!==connectionRequest.current)return;
      const next={api:result.baseURL,m3u:values.m3u.trim()};save('settings',next);setSettings(next);setDraft(next);setDirty(false);setConfig(result.config);
      setFavorites({});setRecords({});setResults([]);setSubmitted('');setDetail(emptyDetail);setHistory([]);
      let authenticated=result.authenticated;
      if(result.config.StorageType==='localstorage'&&!authenticated){try{authenticated=(await request('/api/login',{method:'POST',body:{}})).ok===true;}catch{}}
      if(authenticated&&result.config.StorageType!=='localstorage'){try{await request('/api/favorites');}catch{authenticated=false;}}
      setLoggedIn(authenticated);setLoginError('');setLoginVisible(!authenticated&&openLogin);setRefresh(value=>value+1);
      document.getElementById('preview-note').textContent=`已连接 ${result.config.SiteName||'影视服务器'} · ${new URL(result.baseURL).host}`;
      return true;
    }catch(error){if(token===connectionRequest.current){setConnectionError(error.message);setNotice(error.message);}return false;}
    finally{if(token===connectionRequest.current)setConnecting(false);}
  },[]);
  useEffect(()=>{let active=true;request('/session').then(session=>{if(!active)return;const previous=initialSettings();const api=session.baseURL||previous.api;if(api)connect({...previous,api});else setConnecting(false);}).catch(error=>{setConnectionError(error.message);setConnecting(false);});return()=>{active=false;};},[connect]);
  const login=async()=>{
    if(loggingIn||!password||(config?.StorageType!=='localstorage'&&!username.trim()))return;
    setLoggingIn(true);setLoginError('');
    try{const result=await request('/api/login',{method:'POST',body:{username:config?.StorageType==='localstorage'?undefined:username.trim(),password}});if(!result.ok)throw new Error(result.error||'登录失败，请检查账号信息。');setLoggedIn(true);setLoginVisible(false);setPassword('');setRefresh(value=>value+1);setNotice('已登录服务器。');}
    catch(error){setLoginError(error.message);}finally{setLoggingIn(false);}
  };
  const logout=()=>setConfirm({title:'退出登录',message:'退出当前影视服务器账户？',action:async()=>{try{await request('/api/logout',{method:'POST'});setLoggedIn(false);setFavorites({});setRecords({});setHistory([]);setResults([]);setPassword('');setLoginVisible(true);}catch(error){setNotice(error.message);}}});

  useEffect(()=>{if(!loggedIn||!config)return;let active=true;setLibraryLoading(true);setLibraryError(null);
    Promise.all([loadCollection('favorites'),loadCollection('playrecords')]).then(([f,r])=>{if(active){setFavorites(f||{});setRecords(r||{});}}).catch(error=>{if(active)setLibraryError(error.message);}).finally(()=>{if(active)setLibraryLoading(false);});
    const historyTask=localOnly?Promise.resolve(saved(storageKey('history'),[])):request('/api/searchhistory');
    historyTask.then(value=>{if(active)setHistory(Array.isArray(value)?value:[]);}).catch(()=>{});
    return()=>{active=false;};
  },[loggedIn,config,loadCollection,localOnly,storageKey,refresh]);
  const search=async term=>{
    const value=term.trim();if(!value)return;const token=++searchRequest.current;setKeyword(value);setSubmitted(value);setSearching(true);setSearchError(null);setResults([]);
    try{const data=await request(`/api/search?q=${encodeURIComponent(value)}`);if(token!==searchRequest.current)return;if(!Array.isArray(data.results))throw new Error('服务器没有返回可识别的搜索结果。');setResults(data.results.map(present));const next=[value,...history.filter(item=>item!==value)].slice(0,20);setHistory(next);if(localOnly)save(storageKey('history'),next);else request('/api/searchhistory',{method:'POST',body:{keyword:value}}).catch(()=>{});}
    catch(error){if(token===searchRequest.current)setSearchError(error.message);}finally{if(token===searchRequest.current)setSearching(false);}
  };
  const clearSearch=()=>{searchRequest.current++;setKeyword('');setSubmitted('');setResults([]);setSearchError(null);setSearching(false);};
  const clearHistory=()=>setConfirm({title:'清除搜索记录',message:'清除当前账户的全部搜索记录？',action:async()=>{try{if(localOnly)save(storageKey('history'),[]);else await request('/api/searchhistory',{method:'DELETE'});setHistory([]);}catch(error){setNotice(error.message);}}});
  const open=item=>go(`detail/${encodeURIComponent(item.title)}/${encodeURIComponent(item.source||'')}/${encodeURIComponent(item.id||'')}`);

  useEffect(()=>{if(!loggedIn||!detailKey)return;const token=++detailRequest.current;const controller=new AbortController();setDetail({key:detailKey,items:[],selected:null,loading:true,error:null});
    request(`/api/search?q=${encodeURIComponent(title)}`,{signal:controller.signal}).then(data=>{if(token!==detailRequest.current)return;const all=(data.results||[]).map(present);const items=all.filter(item=>item.title===title);if(!items.length)throw new Error('没有找到这部影片的可用播放源。');const selected=items.find(item=>item.source===preferredSource&&item.id===preferredId)||items.find(item=>item.source===preferredSource)||items[0];setDetail({key:detailKey,items,selected,loading:false,error:null});}).catch(error=>{if(!controller.signal.aborted&&token===detailRequest.current)setDetail({key:detailKey,items:[],selected:null,loading:false,error:error.message});});return()=>controller.abort();
  },[detailKey,title,preferredSource,preferredId,loggedIn,detailRetry]);
  const toggleFavorite=async()=>{const item=detail.selected;if(!item||favoriteBusy)return;setFavoriteBusy(true);try{const key=itemKey(item);const data=await writeCollection('favorites',key,favorites[key]?null:{title:item.title,cover:item.poster,source_name:item.sourceName,total_episodes:item.episodes.length,search_title:title,year:item.year||''});setFavorites(data);}catch(error){setNotice(error.message);}finally{setFavoriteBusy(false);}};
  const play=index=>{const item=detail.selected;if(item)go(`play/${encodeURIComponent(item.title)}/${encodeURIComponent(item.source)}/${encodeURIComponent(item.id)}?episode=${index}`);};
  const record=async(item,index,status)=>{if(!Number.isFinite(status.duration)||status.duration<=0)return;const value={title:item.title,source_name:item.sourceName||item.source,cover:item.poster,index:index+1,total_episodes:item.episodes.length,play_time:status.position/1000,total_time:status.duration/1000,year:item.year||''};try{const data=await writeCollection('playrecords',itemKey(item),value);setRecords(data);}catch(error){setNotice(`观看记录未能同步：${error.message}`);}};
  const removeRecord=item=>setConfirm({title:'删除观看记录',message:`删除“${item.title}”的观看记录？`,action:async()=>{try{setRecords(await writeCollection('playrecords',itemKey(item),null));}catch(error){setNotice(error.message);}}});

  const homeState=useRef({}); homeState.current={homeItems,loadingMore,hasMore,homeLoading};
  const fetchHome=useCallback(async(more=false)=>{const {homeItems,loadingMore,hasMore,homeLoading}=homeState.current;if(!loggedIn||category.type==='record')return;if(more&&(loadingMore||!hasMore||homeLoading))return;const token=++homeRequest.current;if(more){homeState.current.loadingMore=true;setLoadingMore(true);}else setHomeLoading(true);if(!more){setHomeItems([]);setHomeError(null);setHasMore(true);}try{const data=await request(`/api/douban?type=${category.type}&tag=${encodeURIComponent(category.tag||category.tags?.[0]||'热门')}&pageSize=20&pageStart=${more?homeItems.length:0}`);if(token!==homeRequest.current)return;if(!Array.isArray(data.list))throw new Error(data.message||'暂时无法读取影片列表。');const items=data.list.map((item,index)=>({...item,id:String(item.id||`${item.title}-${index}`),source:''}));setHomeItems(previous=>more?[...previous,...items]:items);setHasMore(items.length>=20);}catch(error){if(token===homeRequest.current)setHomeError(error.message);}finally{if(token===homeRequest.current){setHomeLoading(false);setLoadingMore(false);}}},[category,loggedIn]);
  useEffect(()=>{const counter=homeRequest;fetchHome();return()=>{counter.current++;};},[fetchHome,refresh]);
  useEffect(()=>{if(page!=='live'||!settings.m3u)return;let active=true;setLiveLoading(true);setLiveError('');fetch(mediaUrl(settings.m3u,true),{credentials:'same-origin'}).then(async response=>{if(!response.ok)throw new Error('无法读取直播源。');const items=parseChannels(await response.text(),settings.m3u);if(active){setChannels(items);setChannelId(items[0]?.id||'');setGroup(items[0]?.group||'');}}).catch(error=>{if(active)setLiveError(error.message);}).finally(()=>{if(active)setLiveLoading(false);});return()=>{active=false;};},[page,settings.m3u,refresh]);
  const currentChannel=channels.find(item=>item.id===channelId);
  let content;
  if(page==='settings')content=<CinemaSettings {...nav} apiUrl={draft.api} m3uUrl={draft.m3u} remoteEnabled={false} remoteRunning={false} loggedIn={loggedIn} dirty={dirty} saving={connecting} savedMessage={connectionError||(!config?'填写服务器地址后保存':`已连接 ${config.SiteName||'影视服务器'}`)} onApiChange={api=>{setDraft(previous=>({...previous,api}));setDirty(true);}} onM3uChange={m3u=>{setDraft(previous=>({...previous,m3u}));setDirty(true);}} onRemoteChange={()=>setNotice('浏览器可直接输入。手机遥控服务请在电视端开启。')} onSave={()=>connect(draft)} onAccount={()=>loggedIn?logout():config?setLoginVisible(true):connect(draft)} updateSection={<View style={{paddingVertical:24,gap:12}}><Text style={{color:'#b8bec2'}}>浏览器客户端 · {config?`${config.SiteName} / ${config.StorageType}`:'尚未连接服务器'}</Text><Text style={{color:'#b8bec2'}}>登录后使用服务器中的影片、收藏和观看记录。</Text><View style={{alignSelf:'flex-start'}}><CinemaButton label="重新连接" disabled={connecting||!draft.api.trim()} onPress={()=>connect(draft)} /></View></View>}/>;
  else if(connecting||!loggedIn)content=<CinemaShell {...nav} active={page}><CinemaState loading={connecting} title={connecting?'正在连接影视服务器':config?'登录你的影视库':'连接你的影视库'} message={connectionError||(config?`已连接 ${config.SiteName||'服务器'}，登录后即可搜索和观看。`:'在设置中填写 MoonTV / LunaTV 服务器地址。')} action={!connecting&&<View style={{flexDirection:'row',gap:12}}>{config&&<CinemaButton label="登录账户" primary onPress={()=>setLoginVisible(true)} />}<CinemaButton label="服务器设置" onPress={()=>go('settings')} /></View>}/></CinemaShell>;
  else if(page==='search')content=<CinemaSearch {...nav} keyword={keyword} submitted={submitted} history={history} items={results} loading={searching} error={searchError} onChange={setKeyword} onSearch={search} onClear={clearSearch} onClearHistory={clearHistory} onRemoteInput={()=>setNotice('当前是浏览器客户端，可直接使用键盘输入片名。')} onOpen={open} imageUrl={imageUrl}/>;
  else if(page==='favorites')content=<CinemaLibrary {...nav} items={fromStored(favorites)} loading={libraryLoading} error={libraryError} onRetry={()=>setRefresh(value=>value+1)} onOpen={open} imageUrl={imageUrl}/>;
  else if(page==='detail'||page==='play'){
    if(page==='play'&&detail.key===detailKey&&detail.selected&&detail.selected.episodes.length)content=<ConnectedPlayer key={detailKey} item={detail.selected} sources={detail.items} initialEpisode={Math.min(Math.max(0,Number(routeParams.get('episode'))||0),detail.selected.episodes.length-1)} initialPosition={Math.max(0,Number(routeParams.get('position'))||0)} onBack={back} onRecord={record} preferences={saved(storageKey(`player-${itemKey(detail.selected)}`),{})} onPreferences={value=>save(storageKey(`player-${itemKey(detail.selected)}`),value)}/>;
    else content=<CinemaDetail {...nav} item={detail.selected} sources={detail.items} loading={detail.loading||detail.key!==detailKey} error={detail.error} sourcesLoading={false} favorited={!!(detail.selected&&favorites[itemKey(detail.selected)])} favoriteBusy={favoriteBusy} onPlay={play} onFavorite={toggleFavorite} onSource={selected=>setDetail(previous=>({...previous,selected}))} onRetry={()=>setDetailRetry(value=>value+1)} imageUrl={imageUrl}/>;
  }else if(page==='live')content=<CinemaLive {...nav} channels={channels} selectedId={channelId} group={group} onGroup={setGroup} onSelect={channel=>{setChannelId(channel.id);setLiveError('');}} configured={!!settings.m3u} loading={liveLoading} error={liveError} onRetry={()=>setRefresh(value=>value+1)} fullscreen={fullscreen} onFullscreen={setFullscreen} player={<View style={{flex:1,backgroundColor:'#000'}}><BrowserVideo url={currentChannel?.url} controls onError={setLiveError}/>{!!liveError&&<Text style={{position:'absolute',top:'40%',alignSelf:'center',color:'#fff',padding:15,backgroundColor:'#202427'}}>{liveError}</Text>}</View>}/>;
  else content=<CinemaHome categories={categories} selectedCategory={category} items={category.type==='record'?fromStored(records).map(item=>({...item,episodeIndex:item.index,progress:item.total_time>0?item.play_time/item.total_time:0})):homeItems} loading={category.type==='record'?libraryLoading:homeLoading} loadingMore={loadingMore} message={(category.type==='record'?libraryError:homeError)||undefined} needsConfiguration={false} isLoggedIn={loggedIn} onLogout={logout} onCategorySelect={value=>setCategory({...value,tag:value.tag||value.tags?.[0]})} onTagSelect={tag=>setCategory(previous=>({...previous,tag}))} onOpen={item=>item.episodeIndex?go(`play/${encodeURIComponent(item.title)}/${encodeURIComponent(item.source)}/${encodeURIComponent(item.id)}?episode=${item.episodeIndex-1}&position=${(item.play_time||0)*1000}`):open(item)} onRemoveRecord={removeRecord} onLoadMore={()=>fetchHome(true)} onRetry={()=>setRefresh(value=>value+1)} onNavigate={go} imageUrl={imageUrl}/>;
  return <>{content}<CinemaLogin visible={loginVisible} username={username} password={password} needsUsername={config?.StorageType!=='localstorage'} loading={loggingIn} error={loginError} onUsername={setUsername} onPassword={setPassword} onLogin={login} onClose={()=>{setLoginVisible(false);setPassword('');}}/>
    <CinemaDialog visible={!!confirm} title={confirm?.title||''} onClose={()=>setConfirm(null)}><Text style={{color:'#b8bec2',fontSize:16,lineHeight:26}}>{confirm?.message}</Text><View style={{flexDirection:'row',justifyContent:'flex-end',gap:12}}><CinemaButton label="取消" onPress={()=>setConfirm(null)}/><CinemaButton label="确认" primary onPress={()=>{const action=confirm?.action;setConfirm(null);action?.();}}/></View></CinemaDialog>
    {!!notice&&<div role="status" style={{position:'fixed',bottom:42,left:'50%',transform:'translateX(-50%)',maxWidth:'90%',background:'#eef2f0',color:'#101214',padding:'14px 22px',borderRadius:12,zIndex:200}}>{notice}</div>}
  </>;
}
