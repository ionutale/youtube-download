import { json } from '@sveltejs/kit';
import { downloadsManager } from '$lib/server/downloads';

export async function POST({ request }) {
  const { url } = await request.json();
  if (!url) return json({ error: 'URL is required' }, { status: 400 });

  try {
    const items = await downloadsManager.getPlaylistItems(url);
    return json({ items });
  } catch (e) {
    return json({ error: 'Failed to fetch playlist' }, { status: 500 });
  }
}
