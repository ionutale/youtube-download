import type { RequestHandler } from '@sveltejs/kit';
import { downloadsManager } from '$lib/server/downloads';

export const PATCH: RequestHandler = async (ev) => {
  const id = (ev.params as any).id as string;
  const body = await ev.request.json().catch(() => ({}));
  const action = body?.action as 'pause' | 'resume' | 'cancel' | 'retry';
  if (!id || !action) return new Response(JSON.stringify({ error: 'id and action required' }), { status: 400 });
  if (action === 'pause') downloadsManager.pause(id);
  if (action === 'resume') downloadsManager.resume(id);
  if (action === 'cancel') downloadsManager.cancel(id);
  if (action === 'retry') downloadsManager.retry(id);
  return new Response(null, { status: 204 });
};
