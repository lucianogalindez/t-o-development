// Minimal dependency-free static file server for local preview.
// Serves the project root over HTTP so relative asset paths and the
// hero <video> load exactly as they would in production.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.PORT ? Number(process.env.PORT) : 4321;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

http.createServer((req, res) => {
  try {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';
    const filePath = path.join(ROOT, path.normalize(urlPath));
    if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) { res.writeHead(404); res.end('Not found'); return; }
      const ext = path.extname(filePath).toLowerCase();
      const type = TYPES[ext] || 'application/octet-stream';
      // Range support so the browser can stream/seek the hero video.
      const range = req.headers.range;
      if (range && ext === '.mp4') {
        const m = /bytes=(\d*)-(\d*)/.exec(range);
        const start = m && m[1] ? parseInt(m[1], 10) : 0;
        const end = m && m[2] ? parseInt(m[2], 10) : stat.size - 1;
        res.writeHead(206, {
          'Content-Type': type,
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': end - start + 1,
        });
        fs.createReadStream(filePath, { start, end }).pipe(res);
        return;
      }
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size });
      fs.createReadStream(filePath).pipe(res);
    });
  } catch (e) {
    res.writeHead(500); res.end('Server error');
  }
}).listen(PORT, () => console.log(`Preview server on http://localhost:${PORT}`));
