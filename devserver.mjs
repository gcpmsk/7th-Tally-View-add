/**
 * devserver.mjs — सिर्फ़ LOCAL TESTING के लिए (Cloudflare पर इसकी ज़रूरत नहीं)
 * चलाने का तरीका:
 *   DATABASE_URL="postgresql://user:pass@ip:5432/db" node devserver.mjs
 * फिर browser में  http://localhost:8788  खोलें।
 *
 * यह functions/api/*.js वाले वही handlers चलाता है जो Cloudflare Pages चलाता है।
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = process.cwd();
const PORT = process.env.PORT || 8788;
const env  = { DATABASE_URL: process.env.DATABASE_URL || '' };

const submit  = await import('./functions/api/submit.js');
const history = await import('./functions/api/history.js');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
};

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));

  /* ---- API routes ---- */
  if (url.pathname === '/api/submit' || url.pathname === '/api/history') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const request = new Request(url.href, { method: req.method, headers: req.headers, body });

    const mod = url.pathname === '/api/submit' ? submit : history;
    const fn  = req.method === 'POST'    ? mod.onRequestPost
              : req.method === 'GET'     ? mod.onRequestGet
              : req.method === 'OPTIONS' ? mod.onRequestOptions
              : null;

    if (!fn) { res.writeHead(405).end('Method Not Allowed'); return; }

    const out = await fn({ request, env });
    res.writeHead(out.status, Object.fromEntries(out.headers));
    res.end(Buffer.from(await out.arrayBuffer()));
    return;
  }

  /* ---- static files ---- */
  let p = normalize(url.pathname).replace(/^(\.\.[/\\])+/, '');
  if (p === '/' || p === '\\') p = '/index.html';
  const file = join(ROOT, p);
  try {
    await stat(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404');
  }
}).listen(PORT, '0.0.0.0', () => console.log('dev server → http://localhost:' + PORT));
