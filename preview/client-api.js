/* eslint-env browser */
const prefix = '/__dusk';
export class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }
export async function request(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch(`${prefix}${path}`, { method, credentials: 'same-origin', signal, headers: { 'X-Dusk-Client': '1', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text(); let data, parsed = true;
  try { data = JSON.parse(text); } catch { data = null; parsed = false; }
  if (!response.ok) {
    if (response.status === 401 && path !== '/api/login') window.dispatchEvent(new Event('dusk-session-expired'));
    throw new ApiError(data?.error || data?.message || (response.status === 401 ? path === '/api/login' ? '登录失败，请检查用户名和密码。' : '登录已失效，请重新登录。' : `请求失败（${response.status}），请稍后重试。`), response.status);
  }
  if (!parsed) throw new ApiError('服务器返回的数据格式不受支持。', response.status);
  return data;
}
export const imageUrl = url => url ? `${prefix}/api/image-proxy?url=${encodeURIComponent(url)}` : '';
export const mediaUrl = (url, raw = false) => `${prefix}/media?url=${encodeURIComponent(url)}${raw ? '&raw=1' : ''}`;
export function saved(key, fallback) { try { return JSON.parse(localStorage.getItem(`dusktv-live-${key}`) ?? localStorage.getItem(`orion-live-${key}`)) ?? fallback; } catch { return fallback; } }
export function save(key, value) { localStorage.setItem(`dusktv-live-${key}`, JSON.stringify(value)); }
export const itemKey = item => `${item.source}+${item.id}`;
export const present = item => ({ ...item, id: String(item.id), sourceName: item.source_name || item.sourceName, episodes: Array.isArray(item.episodes) ? item.episodes : [] });
export const fromStored = entries => Object.entries(entries || {}).map(([key, value]) => { const [source, ...id] = key.split('+'); return { ...value, id: id.join('+'), source, poster: value.cover, sourceName: value.source_name }; });
export function parseChannels(text, base) {
  const channels = []; let info;
  for(const line of text.split(/\r?\n/).map(value => value.trim())) {
    if(line.startsWith('#EXTINF:')) info = { name: line.slice(line.lastIndexOf(',')+1) || '未命名频道', group: line.match(/group-title="([^"]*)"/i)?.[1] || '其他' };
    else if(info && line && !line.startsWith('#')) { try { const url = new URL(line, base); if(['http:','https:'].includes(url.protocol)) channels.push({...info, id:url.href, url:url.href}); } catch {} info = null; }
  }
  return channels;
}
