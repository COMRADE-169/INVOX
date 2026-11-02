'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');

const PUBLIC_ROOT = path.resolve(__dirname, 'public');
const PORT = Number(process.env.PORT || 3000);
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

const cleanPages = new Set(['about', 'app', 'login', 'profile', 'signup']);

http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end('Invalid URL');
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed');
    return;
  }

  if (pathname === '/') pathname = '/index.html';
  else if (cleanPages.has(pathname.slice(1))) pathname += '.html';
  const filePath = path.resolve(PUBLIC_ROOT, `.${pathname}`);
  if (filePath !== PUBLIC_ROOT && !filePath.startsWith(`${PUBLIC_ROOT}${path.sep}`)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not Found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': ['.html', '.js'].includes(path.extname(filePath).toLowerCase())
        ? 'no-cache'
        : 'public, max-age=3600'
    });
    if (req.method === 'HEAD') res.end();
    else fs.createReadStream(filePath).pipe(res);
  });
}).listen(PORT, () => {
  console.log(`INVOX static site is running at http://127.0.0.1:${PORT}`);
});
