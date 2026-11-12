import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createBridge, normalizeServer, rewritePlaylist } from './server-bridge.mjs';

const listen = async handler => { const server=createServer(handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return {server,url:`http://127.0.0.1:${server.address().port}`}; };
const close = server => new Promise(resolve=>{server.closeAllConnections();server.close(resolve);});
test('server URL and HLS playlist normalization',()=>{
  assert.equal(normalizeServer('https://example.test/path/'),'https://example.test/path');
  for(const value of ['file:///tmp/file','https://user:password@example.test','http://example.test/?token=secret'])assert.throws(()=>normalizeServer(value));
  const text=rewritePlaylist('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\nsegment.ts\nhttps://cdn.example.test/next.ts','https://cdn.example.test/path/main.m3u8');
  assert(text.includes(encodeURIComponent('https://cdn.example.test/path/key.bin')));
  assert(text.includes(encodeURIComponent('https://cdn.example.test/path/segment.ts')));
  assert(text.includes(encodeURIComponent('https://cdn.example.test/next.ts')));
});
test('bridge isolates cookies, forwards API methods, rewrites media and rejects foreign origins',async()=>{
  const seen=[];
  const upstream=await listen(async(req,res)=>{
    seen.push({path:req.url,cookie:req.headers.cookie,range:req.headers.range});
    if(req.url==='/api/server-config'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({SiteName:'Fixture',StorageType:'kvrocks'}));}
    if(req.url==='/api/login'){res.setHeader('Set-Cookie','upstream_auth=fixture-session; Path=/; HttpOnly');return res.end('{"ok":true}');}
    if(req.url==='/api/logout'){res.setHeader('Set-Cookie','upstream_auth=; Path=/; Max-Age=0');return res.end('{"ok":true}');}
    if(req.url.startsWith('/api/favorites')){res.statusCode=req.headers.cookie?.includes('upstream_auth=fixture-session')?200:401;return res.end('{}');}
    if(req.url==='/playlist.m3u8'){res.setHeader('Content-Type','application/vnd.apple.mpegurl');return res.end('#EXTM3U\n#EXTINF:5,\nclip.ts');}
    if(req.url==='/clip.ts'){res.statusCode=req.headers.range?206:200;res.setHeader('Content-Type','video/mp2t');res.setHeader('Content-Range','bytes 0-3/4');res.setHeader('Content-Length','4');return res.end('test');}
    res.statusCode=404;res.end();
  });
  const bridge=await listen(createBridge());
  let cookie='';
  const call=async(path,{method='GET',body,headers={}}={})=>{const response=await fetch(bridge.url+'/__dusk'+path,{method,headers:{Origin:bridge.url,'X-Dusk-Client':'1',...(cookie?{Cookie:cookie}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)});const set=response.headers.get('set-cookie');if(set)cookie=set.split(';')[0];return response;};
  try{
    const session=await call('/session');const set=session.headers.get('set-cookie');assert.match(set,/HttpOnly/);assert.match(set,/SameSite=Strict/);
    assert.equal((await call('/connect',{method:'POST',body:{baseURL:upstream.url}})).status,200);
    assert.equal((await call('/api/favorites')).status,401);
    const login=await call('/api/login',{method:'POST',body:{username:'fixture',password:'test-only-password'}});assert.equal(login.status,200);assert.equal(login.headers.get('set-cookie'),null);
    assert.equal((await call('/api/favorites')).status,200);assert.equal((await (await call('/session')).json()).authenticated,true);
    const playlist=await call('/media?url='+encodeURIComponent(upstream.url+'/playlist.m3u8'));assert((await playlist.text()).includes('/__dusk/media?url='));
    const raw=await call('/media?raw=1&url='+encodeURIComponent(upstream.url+'/playlist.m3u8'));assert((await raw.text()).includes('\nclip.ts'));
    const range=await call('/media?url='+encodeURIComponent(upstream.url+'/clip.ts'),{headers:{Range:'bytes=0-3'}});assert.equal(range.status,206);assert.equal(range.headers.get('content-length'),'4');assert.equal(await range.text(),'test');
    assert.equal(seen.find(value=>value.path==='/clip.ts').cookie,undefined);assert.equal(seen.find(value=>value.path==='/clip.ts').range,'bytes=0-3');
    assert.equal((await call('/api/favorites',{headers:{Origin:'https://foreign.example'}})).status,403);
    assert.equal((await call('/api/login',{method:'POST',body:{},headers:{'X-Dusk-Client':''}})).status,403);
    assert.equal((await call('/api/admin')).status,404);
    const unrelated=await fetch(bridge.url+'/__dusk/api/favorites');assert.equal(unrelated.status,409);
    assert.equal((await call('/api/logout',{method:'POST'})).status,200);assert.equal((await call('/api/favorites')).status,401);
    assert.equal((await (await call('/session')).json()).authenticated,false);
  }finally{await close(bridge.server);await close(upstream.server);}
});
