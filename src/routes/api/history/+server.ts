import { json } from '@sveltejs/kit';
import { dbCompletedHistory, dbDeleteByRel } from '$lib/server/db';
import path from 'path';
import fs from 'fs';
import { DOWNLOAD_DIR } from '$lib/server/config';

export async function GET() {
  const items = dbCompletedHistory();
  return json(items);
}

export async function DELETE({ url }) {
  const rel = url.searchParams.get('rel');
  if (!rel) return new Response(null, { status: 400 });
  // Also remove from DB; file removal remains handled by file-serving cleanup or manual
  try { dbDeleteByRel(rel); } catch {}
  try {
    const safeRel = rel.replace(/\\|\.\.|^\//g, '');
    const abs = path.join(DOWNLOAD_DIR, safeRel);
    if (abs.startsWith(DOWNLOAD_DIR) && fs.existsSync(abs)) fs.unlinkSync(abs);
    const base = abs.replace(/\.[^.]+$/, '');
    const meta = base + '.json';
    if (meta.startsWith(DOWNLOAD_DIR) && fs.existsSync(meta)) fs.unlinkSync(meta);
  } catch {}
  return new Response(null, { status: 204 });
}
