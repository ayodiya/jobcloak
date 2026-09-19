import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, isAbsolute, join, normalize, relative } from 'node:path';

const PORT = Number(process.env.FIXTURE_PORT ?? 8787);
const FIXTURES = join(process.cwd(), 'tests', 'fixtures');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

const THANK_YOU = [
  '<!doctype html>',
  '<html lang="en"><head><meta charset="utf-8"><title>Application submitted</title>',
  '</head><body>',
  '<h1>Thank you for your interest</h1>',
  '<p>Your application has been submitted. We received your application and will be in touch.</p>',
  '</body></html>',
].join('\n');

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    const pathname = decodeURIComponent(url.pathname);

    if (pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (pathname === '/submit' && req.method === 'POST') {
      res.writeHead(303, { Location: '/thank-you' });
      res.end();
      return;
    }
    if (pathname === '/thank-you') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(THANK_YOU);
      return;
    }

    const basePath = pathname === '/' ? 'index.html' : pathname;
    const filePath = normalize(
      join(FIXTURES, extname(basePath) ? basePath : `${basePath}.html`),
    );
    const rel = relative(FIXTURES, filePath);
    if (
      rel === '' ||
      rel.startsWith('..') ||
      isAbsolute(rel) ||
      rel.split(/[\\/]/).includes('..')
    ) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    const body = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Fixture server listening on http://127.0.0.1:${PORT}`);
});
