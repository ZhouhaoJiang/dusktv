import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { CookieJar } from 'tough-cookie';

const prefix = '/__dusk';
const apiMethods = {
  '/api/server-config': ['GET'], '/api/login': ['POST'], '/api/logout': ['POST'],
  '/api/favorites': ['GET', 'POST', 'DELETE'], '/api/playrecords': ['GET', 'POST', 'DELETE'],
  '/api/searchhistory': ['GET', 'POST', 'DELETE'], '/api/search': ['GET'],
  '/api/search/one': ['GET'], '/api/search/resources': ['GET'], '/api/detail': ['GET'],
  '/api/douban': ['GET'], '/api/image-proxy': ['GET'],
};
export function normalizeServer(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('请输入有效的 HTTP 或 HTTPS 服务器地址。');
  return url.href.replace(/\/$/, '');
}
const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
async function bodyOf(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 65536) throw new Error('请求内容过长。'); chunks.push(chunk); }
  return Buffer.concat(chunks);
}
export function rewritePlaylist(text, origin) {
  const proxied = value => {
    const url = new URL(value, origin);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('不支持的播放地址协议。');
    return `${prefix}/media?url=${encodeURIComponent(url.href)}`;
  };
  return text.split(/\r?\n/).map(line => {
    if (!line.trim()) return line;
    if (!line.startsWith('#')) return proxied(line.trim());
    return line.replace(/URI="([^"]+)"/g, (_, uri) => `URI="${proxied(uri)}"`);
  }).join('\n');
}
export function createBridge({ defaultServer = '', fetchImpl = fetch } = {}) {
  const sessions = new Map();
  return async function bridge(req, res, next) {
    const local = new URL(req.url, 'http://localhost');
    if (!local.pathname.startsWith(`${prefix}/`)) return next();
    const requestOrigin = `http://${req.headers.host}`;
    if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '') ||
        (req.headers.origin && req.headers.origin !== requestOrigin) || req.headers['sec-fetch-site'] === 'cross-site' ||
        (req.method !== 'GET' && req.headers['x-dusk-client'] !== '1')) return json(res, 403, { error: '只允许本机客户端访问。' });
    const now = Date.now();
    for (const [key, value] of sessions) if (now - value.touched > 8 * 3600000) sessions.delete(key);
    const cookieId = req.headers.cookie?.match(/(?:^|;\s*)dusk_session=([a-f0-9]{48})(?:;|$)/)?.[1];
    let session = cookieId && sessions.get(cookieId);
    if (!session) {
      if (sessions.size >= 100) return json(res, 429, { error: '会话过多，请稍后重试。' });
      session = { baseURL: defaultServer ? normalizeServer(defaultServer) : '', jar: new CookieJar(), authenticated: false, touched: now };
      const id = randomBytes(24).toString('hex'); sessions.set(id, session);
      res.setHeader('Set-Cookie', `dusk_session=${id}; Path=${prefix}; HttpOnly; SameSite=Strict`);
    }
    session.touched = now;
    try {
      if (local.pathname === `${prefix}/session` && req.method === 'GET') return json(res, 200, { baseURL: session.baseURL, authenticated: session.authenticated });
      if (local.pathname === `${prefix}/connect` && req.method === 'POST') {
        const { baseURL } = JSON.parse((await bodyOf(req)).toString());
        const target = normalizeServer(baseURL);
        const response = await fetchImpl(`${target}/api/server-config`, { signal: AbortSignal.timeout(15000), redirect: 'error' });
        if (!response.ok) return json(res, response.status, { error: '无法读取服务器配置，请检查地址。' });
        const config = await response.json();
        if (!config.StorageType) return json(res, 502, { error: '该地址没有返回兼容的 MoonTV 服务器配置。' });
        if (target !== session.baseURL) { session.jar = new CookieJar(); session.authenticated = false; }
        session.baseURL = target;
        return json(res, 200, { config, baseURL: target, authenticated: session.authenticated });
      }
      if (!session.baseURL) return json(res, 409, { error: '请先连接影视服务器。' });
      if (local.pathname === `${prefix}/media` && req.method === 'GET') {
        // Media never receives the user's API cookies. The bridge is loopback-only
        // and SameSite sessions keep unrelated web pages from using this route.
        if (!cookieId || !sessions.has(cookieId)) return json(res, 401, { error: '请先打开本地客户端。' });
        const target = new URL(local.searchParams.get('url'));
        if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) return json(res, 400, { error: '不支持的播放地址。' });
        const upstream = await fetchImpl(target, { headers: req.headers.range ? { Range: req.headers.range } : {}, signal: AbortSignal.timeout(30000) });
        if (!upstream.ok) return json(res, upstream.status, { error: '无法读取媒体资源。' });
        const type = upstream.headers.get('content-type') || 'application/octet-stream';
        if (local.searchParams.get('raw') !== '1' && (/mpegurl/i.test(type) || /\.m3u8(?:$|\?)/i.test(upstream.url || target.href))) {
          const text = await upstream.text();
          res.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl', 'Cache-Control': 'no-store' });
          return res.end(rewritePlaylist(text, upstream.url || target.href));
        }
        const headers = { 'Content-Type': type, 'Cache-Control': 'no-store' };
        for (const key of ['content-range', 'accept-ranges']) if (upstream.headers.has(key)) headers[key] = upstream.headers.get(key);
        if (!upstream.headers.get('content-encoding') && upstream.headers.has('content-length')) headers['content-length'] = upstream.headers.get('content-length');
        res.writeHead(upstream.status, headers);
        const stream = Readable.fromWeb(upstream.body); res.on('close', () => stream.destroy()); stream.on('error', () => res.destroy()); stream.pipe(res); return;
      }
      const path = local.pathname.slice(prefix.length);
      if (!apiMethods[path]?.includes(req.method)) return json(res, 404, { error: '不支持的接口。' });
      const target = `${session.baseURL}${path}${local.search}`;
      const cookie = await session.jar.getCookieString(target);
      const requestBody = req.method === 'POST' ? await bodyOf(req) : undefined;
      const upstream = await fetchImpl(target, { method: req.method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(requestBody ? { 'Content-Type': 'application/json' } : {}) }, body: requestBody, redirect: 'manual', signal: AbortSignal.timeout(60000) });
      if (upstream.status >= 300 && upstream.status < 400) return json(res, 502, { error: '服务器接口返回了重定向，请确认填写的是服务地址。' });
      for (const value of upstream.headers.getSetCookie()) await session.jar.setCookie(value, target, { ignoreError: true });
      if (path === '/api/login' && upstream.ok) { const result = await upstream.clone().json().catch(() => null); session.authenticated = result?.ok === true; }
      if (path === '/api/logout' && upstream.ok) { session.jar = new CookieJar(); session.authenticated = false; }
      if (upstream.status === 401) session.authenticated = false;
      res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'application/json', 'Cache-Control': 'no-store' });
      const stream = Readable.fromWeb(upstream.body); res.on('close', () => stream.destroy()); stream.on('error', () => res.destroy()); stream.pipe(res);
    } catch (error) {
      if (res.headersSent) return res.destroy();
      // Do not include upstream URLs, cookies, request bodies or credentials in errors/logs.
      const message = error.name === 'TimeoutError' ? '服务器响应超时，请稍后重试。' : error instanceof TypeError || error.message === 'fetch failed' ? '无法连接服务器，请检查地址和网络。' : '请求未完成，请检查服务器地址和网络。';
      json(res, 502, { error: message });
    }
  };
}
export function serverBridge(options) {
  return { name: 'dusk-local-server', configureServer(server) { server.middlewares.use(createBridge(options)); }, configurePreviewServer(server) { server.middlewares.use(createBridge(options)); } };
}
