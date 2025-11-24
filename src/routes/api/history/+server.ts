import { json } from '@sveltejs/kit';
import { downloadsManager } from '$lib/server/downloads';
import path from 'path';
import fs from 'fs';
import { DOWNLOAD_DIR } from '$lib/server/config';

export async function GET() {
  const items = downloadsManager.list().filter(d => d.status === 'completed');
  return json(items);
}

export async function DELETE({ url }) {
  const rel = url.searchParams.get('rel');
  const id = url.searchParams.get('id');
  const all = url.searchParams.get('all') === 'true';
  
  if (all) {
    const allItems = downloadsManager.list().filter(d => d.status === 'completed' || d.status === 'failed' || d.status === 'canceled');
    downloadsManager.delete(allItems.map(d => d.id));
    return new Response(null, { status: 204 });
  }

  if (id) {
    downloadsManager.delete([id]);
    return new Response(null, { status: 204 });
  }

  if (!rel) return new Response(null, { status: 400 });
  // Legacy deletion by path
  // ... (keep existing logic if needed, or just rely on ID)
  return new Response(null, { status: 204 });
}
