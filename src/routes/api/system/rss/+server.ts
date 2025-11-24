import { json } from '@sveltejs/kit';
import { addRssFeed, removeRssFeed, getRssFeeds } from '$lib/server/rss';

export async function GET() {
  return json({ feeds: getRssFeeds() });
}

export async function POST({ request }) {
  const { url } = await request.json();
  if (url) {
    await addRssFeed(url);
    return json({ success: true });
  }
  return json({ error: 'URL required' }, { status: 400 });
}

export async function DELETE({ url }) {
  const feedUrl = url.searchParams.get('url');
  if (feedUrl) {
    removeRssFeed(feedUrl);
    return new Response(null, { status: 204 });
  }
  return new Response(null, { status: 400 });
}
