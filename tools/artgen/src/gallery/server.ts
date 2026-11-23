import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage } from 'node:http';
import { sep } from 'node:path';
import { z } from 'zod';
import { readManifest, ReviewSchema, setReview, writeManifest } from '../manifest.js';
import { fromRepo, REPO_ROOT } from '../paths.js';
import { galleryHtml } from './html.js';

const ReviewBody = z.object({
  entryId: z.string(),
  index: z.number().int(),
  review: ReviewSchema,
  note: z.string().max(500).optional(),
});

async function readBody(req: IncomingMessage): Promise<string> {
  let data = '';
  for await (const chunk of req) data += String(chunk);
  return data;
}

/** Local review server: the gallery page, the PNGs it shows, and POST /api/review → manifest. */
export function startGalleryServer(port: number, manifestPath?: string) {
  const server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      try {
        if (req.method === 'GET' && url.pathname === '/') {
          const manifest = await readManifest(manifestPath);
          const html = galleryHtml(manifest, {
            interactive: true,
            src: (f) => `/files/${encodeURI(f)}`,
          });
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html);
          return;
        }
        if (req.method === 'GET' && url.pathname.startsWith('/files/')) {
          const abs = fromRepo(decodeURI(url.pathname.slice('/files/'.length)));
          if (!abs.startsWith(REPO_ROOT + sep) || !abs.endsWith('.png')) {
            res.writeHead(403).end('forbidden');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'image/png' }).end(await readFile(abs));
          return;
        }
        if (req.method === 'POST' && url.pathname === '/api/review') {
          const body = ReviewBody.parse(JSON.parse(await readBody(req)));
          const manifest = await readManifest(manifestPath);
          if (!setReview(manifest, body.entryId, body.index, body.review, body.note)) {
            res.writeHead(404).end('no such candidate');
            return;
          }
          await writeManifest(manifest, manifestPath);
          res.writeHead(204).end();
          return;
        }
        res.writeHead(404).end('not found');
      } catch (e) {
        res.writeHead(400).end(String(e));
      }
    })();
  });
  server.listen(port, '127.0.0.1');
  return server;
}
