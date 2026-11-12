import { chromium, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const mediaPath=join(tmpdir(),'dusktv-browser-qa.mp4');
execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','testsrc2=s=320x180:d=60','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-movflags','+faststart',mediaPath]);
execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',mediaPath,'-c','copy','-hls_time','4','-hls_list_size','0','-hls_segment_filename',join(tmpdir(),'dusktv-qa-%03d.ts'),join(tmpdir(),'dusktv-qa.m3u8')]);
const clip=await readFile(mediaPath), checks=[], mutations=[], requests=[];
let favorites={},records={},history=[],expired=false,serverURL='';
const item=()=>({id:1,title:'集成测试影片',source:'fixture',source_name:'本地测试源',poster:'https://fixture.invalid/poster.jpg',year:'2026',episodes:[`第 1 集$${serverURL}/clip.mp4`,`第 2 集$${serverURL}/dusktv-qa.m3u8`],desc:'仅用于验证真实接口适配，不是用户影片。'});
const fixture=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://fixture');requests.push({path:url.pathname,method:req.method});
  const json=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
  if(url.pathname==='/api/server-config')return json({SiteName:'集成测试服务',StorageType:'kvrocks'});
  if(url.pathname==='/clip.mp4'){
    const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    const first=range?Number(range[1]):0, last=range&&range[2]?Math.min(Number(range[2]),clip.length-1):clip.length-1;
    const data=clip.subarray(first,last+1);
    res.writeHead(range?206:200,{'Content-Type':'video/mp4','Content-Length':data.length,'Accept-Ranges':'bytes',...(range?{'Content-Range':`bytes ${first}-${last}/${clip.length}`}:{})});return res.end(data);
  }
  if(/^\/dusktv-qa(?:-\d{3}\.ts|\.m3u8)$/.test(url.pathname)){const file=await readFile(join(tmpdir(),url.pathname.slice(1)));res.writeHead(200,{'Content-Type':url.pathname.endsWith('.ts')?'video/mp2t':'application/vnd.apple.mpegurl'});return res.end(file);}
  if(url.pathname==='/channels.m3u'){res.setHeader('Content-Type','application/vnd.apple.mpegurl');return res.end(`#EXTM3U\n#EXTINF:-1 group-title="测试",测试频道\n${serverURL}/clip.mp4`);}
  let body={};if(req.method==='POST'){const chunks=[];for await(const chunk of req)chunks.push(chunk);body=JSON.parse(Buffer.concat(chunks).toString()||'{}');}
  if(url.pathname==='/api/login'){
    if(body.username!=='fixture'||body.password!=='test-only-password')return json({error:'测试账号或密码错误'},401);
    expired=false;res.setHeader('Set-Cookie','auth=fixture-only-session; HttpOnly; Path=/');return json({ok:true});
  }
  if(url.pathname==='/api/logout'){res.setHeader('Set-Cookie','auth=; Max-Age=0; Path=/');return json({ok:true});}
  if(!req.headers.cookie?.includes('auth=fixture-only-session')||expired)return json({error:'登录已失效'},401);
  if(url.pathname==='/api/favorites'){
    if(req.method==='POST'){favorites[body.key]=body.favorite;mutations.push('favorite:add');}
    if(req.method==='DELETE'){delete favorites[url.searchParams.get('key')];mutations.push('favorite:delete');}
    return json(url.searchParams.has('key')?favorites[url.searchParams.get('key')]||null:favorites);
  }
  if(url.pathname==='/api/playrecords'){if(req.method==='POST'){records[body.key]=body.record;mutations.push('record:save');}if(req.method==='DELETE')delete records[url.searchParams.get('key')];return json(records);}
  if(url.pathname==='/api/searchhistory'){if(req.method==='POST')history=[body.keyword,...history.filter(value=>value!==body.keyword)];if(req.method==='DELETE')history=[];return json(history);}
  if(url.pathname==='/api/search'){
    const q=url.searchParams.get('q');if(q==='失败')return json({error:'测试服务器暂时不可用'},503);
    if(q==='慢请求')return setTimeout(()=>json({results:[{...item(),title:'过期结果'}]}),500);
    return json({results:q==='无结果'?[]:[item()]});
  }
  if(url.pathname==='/api/douban')return json({code:200,list:[item()]});
  if(url.pathname==='/api/image-proxy'){res.writeHead(200,{'Content-Type':'image/svg+xml'});return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#90cdb4"/></svg>');}
  return json({error:'not found'},404);
});
await new Promise(resolve=>fixture.listen(0,'127.0.0.1',resolve));serverURL=`http://127.0.0.1:${fixture.address().port}`;
const browser=await chromium.launch({headless:true,channel:'chrome'}), context=await browser.newContext({viewport:{width:1440,height:900}}), page=await context.newPage();
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const base=(process.env.PREVIEW_URL||'http://127.0.0.1:4318').replace(/\/$/,''), button=name=>page.getByRole('button',{name,exact:true});
const check=name=>{checks.push(name);console.log('PASS',name);};
try{
  await context.request.get(base+'/__dusk/session');
  const connected=await context.request.post(base+'/__dusk/connect',{headers:{Origin:base,'X-Dusk-Client':'1'},data:{baseURL:serverURL}});assert.equal(connected.status(),200);
  await page.goto(base+'/#settings');await expect(page.getByRole('textbox',{name:'用户名'})).toBeVisible();
  await page.getByRole('textbox',{name:'用户名'}).fill('fixture');await page.getByLabel('密码',{exact:true}).fill('incorrect');await button('登录').click();await expect(page.getByText('测试账号或密码错误',{exact:true})).toBeVisible();
  await page.getByLabel('密码',{exact:true}).fill('test-only-password');await button('登录').click();await expect(button('退出登录')).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(0);
  assert(!(await page.evaluate(()=>JSON.stringify(localStorage))).includes('test-only-password'));assert(!(await page.evaluate(()=>document.cookie)).includes('fixture-only-session'));
  check('Real HTTP login failures/success, HttpOnly upstream session, no password in browser storage');
  await page.reload();await expect(button('退出登录')).toBeVisible();await expect(page.getByRole('textbox',{name:'用户名'})).toHaveCount(0);
  check('Session survives page refresh without saving a password');
  await button('搜索').click();const input=page.getByRole('textbox',{name:'搜索片名'});
  await input.fill('慢请求');await input.press('Enter');await input.fill('集成测试影片');await input.press('Enter');await expect(button('集成测试影片')).toBeVisible();await page.waitForTimeout(600);await expect(button('过期结果')).toHaveCount(0);
  await input.fill('失败');await input.press('Enter');await expect(page.getByText('测试服务器暂时不可用',{exact:true})).toBeVisible();
  await input.fill('无结果');await input.press('Enter');await expect(page.getByText('没有找到“无结果”')).toBeVisible();
  await input.fill('集成测试影片');await input.press('Enter');await button('集成测试影片').click();await button('加入收藏').click();await expect(button('已收藏')).toBeVisible();assert.equal(favorites['fixture+1'].title,'集成测试影片');
  check('Actual search API, stale response protection, API errors, no results and favorite writes');
  await button('收藏').click();await button('集成测试影片').click();await button('开始播放').click();
  await page.waitForFunction(()=>document.querySelector('video')?.readyState>=1);await button('播放').click();await expect(button('暂停')).toBeVisible();await page.waitForTimeout(400);await button('暂停').click();
  const slider = page.getByRole('slider', { name: '定位', exact: true });
  const bounds = await slider.locator('..').boundingBox();
  await page.mouse.move(bounds.x + 4, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.55, bounds.y + bounds.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect.poll(() => page.locator('video').evaluate(v => v.currentTime)).toBeGreaterThan(28);
  await expect.poll(() => page.locator('video').evaluate(v => v.currentTime)).toBeLessThan(38);
  await slider.focus(); await page.keyboard.press('ArrowLeft');
  await expect.poll(() => page.locator('video').evaluate(v => v.currentTime)).toBeLessThan(33);
  await button('静音').click(); assert.equal(await page.locator('video').evaluate(v => v.muted), true);
  await button('取消静音').click(); assert.equal(await page.locator('video').evaluate(v => v.muted), false);
  await button('设置').click(); await page.getByRole('menuitem', { name: /速度/ }).click();
  await page.getByRole('menuitemradio', { name: '1.5×', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect.poll(() => page.locator('video').evaluate(v => v.playbackRate)).toBe(1.5);
  check('Video.js real pointer timeline drag, keyboard seeking, mute and playback-rate controls');
  await button('选集').click(); await expect(page.getByRole('dialog', { name: '选择剧集' })).toBeVisible(); await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await button('全屏').click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement || document.body.textContent.includes('浏览器拒绝了全屏请求'))).toBe(true);
  if (await page.evaluate(() => !!document.fullscreenElement)) {
    await button('选集').click(); await expect(page.getByRole('dialog', { name: '选择剧集' })).toBeVisible(); await page.keyboard.press('Escape');
    await button('退出全屏').click(); await page.waitForFunction(() => !document.fullscreenElement);
    check('Real browser fullscreen enter, dialog visibility and exit');
  } else {
    console.log('LIMITATION Local Chrome rejects fullscreen; rejection feedback verified, native fullscreen not verified');
    await button('知道了').click();
  }
  await expect(button('画中画')).toBeVisible();
  await page.screenshot({path:'qa-artifacts/videojs-player.png'});

  await button('下一集').click();await expect(page.getByText('第 2 集 / 本地测试源',{exact:true})).toBeVisible();await page.waitForFunction(()=>document.querySelector('video')?.readyState>=1);
  await page.waitForFunction(()=>document.querySelector('video')?.currentSrc.startsWith('blob:'));
  await button('选集').click(); await button('第 1 集').click();
  await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2 && !document.querySelector('video').currentSrc.startsWith('blob:'));
  await expect.poll(()=>page.locator('video').evaluate(v=>v.currentTime)).toBeLessThan(1);
  // Put the clip just before its end, then verify the real ended event advances playback.
  await page.locator('video').evaluate(v=>{v.currentTime=v.duration-0.3;});
  await button('播放').click();
  await expect(page.getByText('第 2 集 / 本地测试源',{exact:true})).toBeVisible();
  await page.waitForFunction(()=>document.querySelector('video')?.currentSrc.startsWith('blob:') && !document.querySelector('video').paused);
  await button('暂停').click();await button('返回影片').click();await page.waitForTimeout(500);
  assert(mutations.includes('record:save'));assert(records['fixture+1']);
  check('Actual MP4 and HLS segment playback, speed, episode restart, automatic next episode and watch-history synchronization');
  await button('已收藏').click();await expect(button('加入收藏')).toBeVisible();assert.equal(favorites['fixture+1'],undefined);
  await button('设置').click();await page.getByRole('textbox',{name:'直播源地址'}).fill(serverURL+'/channels.m3u');await button('保存设置').click();await expect(page.getByText('已连接 集成测试服务',{exact:true})).toBeVisible();await button('直播').click();await expect(button('测试频道')).toBeVisible();await page.waitForFunction(()=>document.querySelector('video')?.readyState>=1);
  await button('全屏观看').click();await button('退出全屏').click();
  check('M3U loading, real channel video and expanded page layout');
  expired=true;await button('搜索').click();await page.getByRole('textbox',{name:'搜索片名'}).fill('过期');await page.getByRole('textbox',{name:'搜索片名'}).press('Enter');await expect(page.getByRole('textbox',{name:'用户名'})).toBeVisible();
  await page.getByRole('textbox',{name:'用户名'}).fill('fixture');await page.getByLabel('密码',{exact:true}).fill('test-only-password');await button('登录').click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await button('设置').click();await button('退出登录').click();await button('确认').click();await expect(page.getByRole('textbox',{name:'用户名'})).toBeVisible();
  check('Session expiration prompts real login; logout clears upstream authentication');
  assert.deepEqual(errors,[]);
  await mkdir(new URL('./qa-artifacts/',import.meta.url),{recursive:true});
  await writeFile(new URL('./qa-artifacts/connected-results.json',import.meta.url),JSON.stringify({checks,mutations,pageErrors:errors,backend:'isolated local fixture; no user account used'},null,2));
  console.log('Completed',checks.length,'connected check groups.');
}catch(error){await page.screenshot({path:'qa-artifacts/player-failure.png'});console.log((await page.locator('body').innerText()).slice(-2000));throw error;}finally{await browser.close();fixture.closeAllConnections();await new Promise(resolve=>fixture.close(resolve));}
