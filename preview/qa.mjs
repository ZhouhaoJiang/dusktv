import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4318/';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
const button = name => page.getByRole('button', { name, exact: true });
const goto = async (route, state = '') => { await page.goto(`${base}?demo=1${state ? `&state=${state}` : ''}#${route}`); await page.waitForTimeout(180); };
const check = name => { checks.push(name); console.log(`PASS ${name}`); };
await mkdir(new URL('./qa-artifacts/', import.meta.url), { recursive: true });
try {
  await goto('search');
  const input = page.getByRole('textbox', { name: '搜索片名' });
  await input.fill('沙丘'); await input.press('Enter');
  await expect(button('沙丘 2')).toBeVisible();
  await input.fill('不存在的影片 xyz'); await button('搜索影片').click();
  await expect(page.getByText('没有找到“ 不存在的影片 xyz”'.replace('“ ', '“'))).toBeVisible();
  await button('清空搜索').click();
  await button('沙丘').click(); await expect(button('沙丘 2')).toBeVisible();
  await button('清空搜索').click();
  await button('清除记录').click(); await button('取消').click(); await expect(button('沙丘')).toBeVisible();
  await button('清除记录').click(); await button('确认').click();
  await expect(page.getByText('还没有搜索记录。输入片名，或使用手机遥控输入。')).toBeVisible();
  check('Search submission, no results, clear, history reuse and confirmed history deletion');

  await input.fill('沙丘'); await input.press('Enter'); await button('沙丘 2').click();
  await button('加入收藏').click(); await expect(button('已收藏')).toBeVisible();
  await button('收藏').click(); await expect(button('沙丘 2')).toBeVisible();
  await page.reload(); await expect(button('沙丘 2')).toBeVisible();
  await button('沙丘 2').click(); await button('已收藏').click(); await expect(button('加入收藏')).toBeVisible();
  await button('演示片源 2').click(); await expect(button('演示片源 2')).toHaveAttribute('aria-selected', 'true');
  check('Detail source selection and persistent favorite add/remove');

  await button('开始播放').click();
  await page.waitForFunction(() => document.querySelector('video')?.readyState >= 1, { timeout: 15000 });
  await button('播放').click(); await expect(button('暂停')).toBeVisible();
  await button('暂停').click(); await expect(button('播放')).toBeVisible();
  await button('1× 倍速').click(); await button('1.5×').click();
  assert.equal(await page.locator('video').evaluate(v => v.playbackRate), 1.5);
  await button('快进 20 秒').click(); assert((await page.locator('video').evaluate(v => v.currentTime)) > 0);
  await button('快退 20 秒').click(); assert.equal(await page.locator('video').evaluate(v => v.currentTime), 0);
  await expect(button('下一集')).toHaveAttribute('aria-disabled', 'true');
  await button('换源').click(); await button('演示线路 2').click(); await expect(page.getByText(/公共测试片段，非影片正片 \/ 演示线路 2/)).toBeVisible();
  await button('选集').click(); await button('公共测试片段').click();
  await button('隐藏控制栏').click(); await button('显示控制栏').click();
  check('Public test video loads; playback, seek bounds, speed, source, episodes, disabled next and controls visibility');

  await goto('live');
  assert((await button('纪实').boundingBox()).height < 70, 'Live group tabs must not stretch to fill the channel column');
  await button('旅行风景').click(); await expect(button('旅行风景')).toHaveAttribute('aria-selected', 'true');
  await button('影视').click(); await button('电影频道').click();
  await button('全屏观看').click(); await button('退出全屏').click(); await expect(button('影视')).toBeVisible();
  check('Live grouping, channel selection and fullscreen exit');

  await goto('settings');
  const api = page.getByRole('textbox', { name: '服务器地址' });
  await api.fill('https://preview.example'); await button('已关闭').click(); await button('保存设置').click();
  await page.reload(); await expect(api).toHaveValue('https://preview.example'); await expect(button('已开启')).toBeVisible();
  await api.fill('https://unsaved.example'); await button('首页').click(); await button('取消').click(); await expect(api).toHaveValue('https://unsaved.example');
  await button('首页').click(); await button('确认').click(); await button('设置').click(); await expect(api).toHaveValue('https://preview.example');
  await button('登录账户').click(); await expect(button('登录')).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('textbox', { name: '用户名' }).fill('demo'); await page.getByLabel('密码', { exact: true }).fill('preview-only'); await button('登录').click();
  await expect(page.getByText('预览不验证或保存登录信息。请在正式应用中连接服务器后登录。')).toBeVisible();
  assert(!(await page.evaluate(() => JSON.stringify(localStorage))).includes('preview-only'));
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(button('登录')).toHaveCount(0);
  await button('查看更新弹窗').click(); await button('关闭').click(); await expect(button('关闭')).toHaveCount(0);
  await button('搜索').click(); await button('手机输入').click(); await button('关闭').click(); await expect(button('关闭')).toHaveCount(0);
  check('Settings persistence, discard protection, login validation, no credential persistence, modal close and Escape');

  await button('首页').focus(); await page.keyboard.press('ArrowRight');
  await expect(button('直播')).toBeFocused(); await page.keyboard.press('Enter'); await expect(button('全屏观看')).toBeVisible();
  check('Directional keyboard navigation and Enter activation');

  for (const viewport of [{width:1440,height:900},{width:960,height:540},{width:1920,height:1080},{width:900,height:700},{width:390,height:844},{width:320,height:640}]) {
    await page.setViewportSize(viewport);
    for (const route of ['home', 'search', 'detail/dune', 'favorites', 'live', 'settings', 'play/dune']) {
      await goto(route);
      const overflow = await page.evaluate(() => [...document.querySelectorAll('[role="button"],input')].filter(el => {
        const r = el.getBoundingClientRect(); if (!r.width || (r.left >= -1 && r.right <= innerWidth + 1)) return false;
        for(let parent = el.parentElement; parent; parent = parent.parentElement) { if (['auto','scroll'].includes(getComputedStyle(parent).overflowX)) return false; }
        return true;
      }).map(el => el.getAttribute('aria-label') || el.textContent));
      assert.deepEqual(overflow, [], `${viewport.width} ${route}: horizontal clipping`);
      if (route.startsWith('play')) {
        const clipped = await page.evaluate(() => [...document.querySelectorAll('[role="button"]')].filter(el => { const r = el.getBoundingClientRect(); return r.top < -1 || r.bottom > innerHeight - 25; }).map(el => el.getAttribute('aria-label')));
        assert.deepEqual(clipped, [], `${viewport.width} player controls clipped`);
      }
      if ([1440,390].includes(viewport.width)) await page.screenshot({ path: new URL(`./qa-artifacts/${viewport.width}-${route.replace('/','-')}.png`, import.meta.url).pathname });
    }
    check(`${viewport.width}×${viewport.height}: seven routes without unintended horizontal overflow`);
  }
  await page.setViewportSize({width:1440,height:900});
  for(const [route,state,expected] of [
    ['home','empty','下一部好片，等你发现'], ['home','config','连接你的影视库'], ['home','error','暂时无法加载'],
    ['favorites','empty','收藏你的下一部好片'], ['favorites','error','收藏暂时无法加载'], ['detail/dune','error','暂时无法显示影片'],
    ['live','config','添加你的直播频道'], ['live','empty','暂时没有可用频道'], ['live','loading','正在加载频道'],
  ]) {
    await goto(route,state); await expect(page.getByText(expected,{exact:true})).toBeVisible();
  }
  await goto('search','error'); await input.fill('沙丘'); await input.press('Enter'); await expect(page.getByText('搜索暂时不可用',{exact:true})).toBeVisible();
  await goto('search','loading'); await input.fill('沙丘'); await input.press('Enter'); await expect(page.getByText('正在搜索“沙丘”')).toBeVisible();
  await goto('home','broken'); await page.waitForTimeout(300); assert.equal(await page.locator('img').count(),0);
  await goto('home','long-title'); await page.screenshot({path:new URL('./qa-artifacts/long-title.png',import.meta.url).pathname});
  check('Empty, configuration, error, loading, broken poster and long title states');
  assert.deepEqual(errors,[],'Uncaught browser errors');
  await goto('search'); await page.screenshot({ path:new URL('./search-review.png',import.meta.url).pathname });
  await writeFile(new URL('./qa-artifacts/results.json',import.meta.url),JSON.stringify({checks,pageErrors:errors},null,2));
  console.log(`Completed ${checks.length} check groups.`);
} finally { await browser.close(); }
