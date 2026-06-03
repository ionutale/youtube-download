import { json } from '@sveltejs/kit';
import { pause, resume, cancel, retry, toggleFavorite, setPriority, deleteDownloads } from '$lib/server/download/commands';

export async function PATCH({ params, request }) {
  const id = params.id;
  const body = await request.json().catch(() => ({}));
  const action = body.action;

  if (!id) return json({ error: 'ID required' }, { status: 400 });

  if (action === 'pause') {
    pause(id);
    return json({ success: true });
  } else if (action === 'resume') {
    resume(id);
    return json({ success: true });
  } else if (action === 'cancel') {
    cancel(id);
    return json({ success: true });
  } else if (action === 'retry') {
    const rec = await retry(id);
    return json({ success: true, id: rec?.id });
  } else if (action === 'favorite') {
    toggleFavorite(id);
    return json({ success: true });
  } else if (action === 'setPriority') {
    const priority = body.priority;
    if (typeof priority === 'number') {
      setPriority(id, priority);
      return json({ success: true });
    }
  }

  return json({ error: 'Invalid action' }, { status: 400 });
}

export async function DELETE({ params }) {
  const id = params.id;
  if (!id) return json({ error: 'ID required' }, { status: 400 });
  
  await deleteDownloads([id]);
  return json({ success: true });
}
