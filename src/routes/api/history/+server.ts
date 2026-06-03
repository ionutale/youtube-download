import { json } from '@sveltejs/kit';
import { list } from '$lib/server/download/queries';
import { deleteDownloads } from '$lib/server/download/commands';
import path from 'path';
import fs from 'fs';
import { DOWNLOAD_DIR } from '$lib/server/config';

export async function GET() {
  const items = list({ status: 'completed' });
  return json(items);
}

export async function DELETE({ url, request }) {
  const rel = url.searchParams.get('rel');
  const id = url.searchParams.get('id');
  const all = url.searchParams.get('all') === 'true';
  
  if (all) {
    const allItems = list({ status: ['completed', 'failed', 'canceled'] });
    await deleteDownloads(allItems.map(d => d.id));
    return new Response(null, { status: 204 });
  }

  if (id) {
    await deleteDownloads([id]);
    return new Response(null, { status: 204 });
  }

  // Try to parse body for bulk delete
  try {
    const body = await request.json();
    if (body.ids && Array.isArray(body.ids)) {
      await deleteDownloads(body.ids);
      return new Response(null, { status: 204 });
    }
  } catch {}

  return new Response(null, { status: 400 });
}
