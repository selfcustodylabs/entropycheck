import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const artifact = fileURLToPath(new URL('../seedinspect.html', import.meta.url));
const server = createServer(async (req, res) => {
  if (!['/', '/index.html', '/seedinspect.html'].includes(req.url?.split('?')[0])) { res.writeHead(404); res.end('Not found'); return; }
  try {
    const html = await readFile(artifact);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' });
    res.end(html);
  } catch { res.writeHead(503); res.end('Build first: npm run build'); }
});
server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log(`SeedInspect preview: http://127.0.0.1:${process.env.PORT || 4173}`));
