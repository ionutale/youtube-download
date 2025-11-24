import { json } from '@sveltejs/kit';
import { downloadsManager } from '$lib/server/downloads';

export async function PATCH({ params, request }) {
  const id = params.id;
  const body = await request.json().catch(() => ({}));
  const action = body.action;

  if (!id) return json({ error: 'ID required' }, { status: 400 });

  if (action === 'pause') {
    downloadsManager.pause(id);
    return json({ success: true });
  } else if (action === 'resume') {
    downloadsManager.resume(id);
    return json({ success: true });
  } else if (action === 'retry') {
    const rec = await downloadsManager.retry(id);
    return json({ success: true, id: rec?.id });
  }

  return json({ error: 'Invalid action' }, { status: 400 });
}

export async function DELETE({ params }) {
  const id = params.id;
  if (!id) return json({ error: 'ID required' }, { status: 400 });
  
  downloadsManager.cancel(id);
  return json({ success: true });
}
