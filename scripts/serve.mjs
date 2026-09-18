import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requestedDirectory = process.argv[2] || 'dist';
const root = path.resolve(repoRoot, requestedDirectory);
const port = Number(process.env.PORT || 3000);
const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json']
]);

function resolveRequest(url) {
  const pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const resolved = path.resolve(root, relative);
  return resolved.startsWith(`${root}${path.sep}`) || resolved === root ? resolved : null;
}

const server = createServer(async (request, response) => {
  let filePath = resolveRequest(request.url || '/');
  if (!filePath) {
    response.writeHead(400).end('Bad request');
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) filePath = path.join(filePath, 'index.html');
    await stat(filePath);
  } catch {
    filePath = path.join(root, '404.html');
  }

  response.writeHead(filePath.endsWith('404.html') ? 404 : 200, {
    'Content-Type': mimeTypes.get(path.extname(filePath)) || 'application/octet-stream',
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff'
  });
  createReadStream(filePath).pipe(response);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Lingan-Agronomist available at http://0.0.0.0:${port}`);
  console.log(`Serving ${root}`);
});
