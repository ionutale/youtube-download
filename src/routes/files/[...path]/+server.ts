import type { RequestHandler } from '@sveltejs/kit';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import { DOWNLOAD_DIR } from '$lib/server/config';

export const GET: RequestHandler = async (ev) => {
  const relParam = ev.params?.path ?? '';
  const rel = Array.isArray(relParam) ? relParam.join('/') : relParam;
  const safeRel = rel.toString().replace(/\\|\.\.|^\//g, '');
  const abs = path.join(DOWNLOAD_DIR, safeRel);
  if (!abs.startsWith(DOWNLOAD_DIR)) return new Response('Forbidden', { status: 403 });
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return new Response('Not found', { status: 404 });

  const stat = fs.statSync(abs);
  const total = stat.size;
  const contentType = (mime.lookup(abs) || 'application/octet-stream') as string;
  const range = ev.request.headers.get('range');

  if (range) {
    const match = /bytes=(\d+)-(\d+)?/.exec(range);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : total - 1;
      const chunk = fs.createReadStream(abs, { start, end });
      return new Response(chunk as any, {
        status: 206,
        headers: {
          'Content-Type': contentType,
          'Content-Range': `bytes ${start}-${end}/${total}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(end - start + 1)
        }
      });
    }
  }

  const stream = fs.createReadStream(abs);
  return new Response(stream as any, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(total)
    }
  });
};
