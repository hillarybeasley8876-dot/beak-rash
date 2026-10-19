// Short-lived static file server for the http comparison run (serves an existing dist/).
// Listens on an OS-assigned free port on 127.0.0.1 (never a fixed port such as 5300/5310/9333).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg',
  '.svg': 'image/svg+xml', '.md': 'text/plain; charset=utf-8',
};

/** Starts serving `dir`; resolves to { url, close() }. */
export function serveDir(dir) {
  const rootDir = path.resolve(dir);
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    let file = path.join(rootDir, pathname);
    if (!file.startsWith(rootDir)) {
      res.writeHead(403).end();
      return;
    }
    if (pathname.endsWith('/')) file = path.join(file, 'index.html');
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' }).end(data);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const close = () => new Promise((r) => {
        server.closeAllConnections();
        server.close(() => r());
      });
      resolve({ url: `http://127.0.0.1:${port}/`, port, close });
    });
  });
}
