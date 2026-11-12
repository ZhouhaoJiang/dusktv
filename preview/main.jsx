/* eslint-env browser */
import React from 'react';
import { createRoot } from 'react-dom/client';
import DemoApp from './DemoApp';
import ConnectedApp from './ConnectedApp';
const demo = new URLSearchParams(location.search).get('demo') === '1';
if (!demo) document.getElementById('preview-note').textContent = '本地浏览器客户端 · 连接你的影视服务器';
createRoot(document.getElementById('root')).render(demo ? <DemoApp /> : <ConnectedApp />);
