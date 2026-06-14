import { json } from '@sveltejs/kit';
import { enqueue } from '$lib/server/download/commands';
import { isValidUrl } from '$lib/server/util';
import { DEFAULT_FORMAT, DEFAULT_QUALITY } from '$lib/server/config';

export async function POST({ request }) {
  const body = await request.json().catch(() => ({}));
  const { url, pageUrl, title, format, quality } = body;

  if (!url) return json({ error: 'URL is required' }, { status: 400 });
  if (!isValidUrl(url)) return json({ error: 'Invalid URL' }, { status: 400 });

  try {
    const records = await enqueue(url, {
      format: format || DEFAULT_FORMAT,
      quality: quality || DEFAULT_QUALITY,
      category: 'extension-capture'
    });

    if (title && records[0]) {
      const { engine } = await import('$lib/server/download/engine');
      engine.update(records[0].id, { title, url: pageUrl || url });
    }

    return json({ id: records[0].id, count: records.length });
  } catch (error: any) {
    console.error('[POST /api/capture] error:', error);
    return json({ error: 'Failed to process capture' }, { status: 500 });
  }
}
