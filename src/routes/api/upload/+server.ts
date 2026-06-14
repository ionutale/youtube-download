import { json } from '@sveltejs/kit';
import { handleUploadChunk } from '$lib/server/upload';

export async function POST({ request }) {
  try {
    const formData = await request.formData();
    const session = formData.get('session') as string;
    const indexStr = formData.get('index') as string;
    const isFinal = formData.get('final') === 'true';
    const pageUrl = formData.get('pageUrl') as string | undefined;
    const title = formData.get('title') as string | undefined;

    if (!session) return json({ error: 'session required' }, { status: 400 });

    let data: Buffer | undefined;
    if (!isFinal) {
      const file = formData.get('data');
      if (!file || typeof file === 'string') {
        return json({ error: 'data required for non-final chunk' }, { status: 400 });
      }
      const arrayBuffer = await (file as File).arrayBuffer();
      data = Buffer.from(arrayBuffer);
    }

    const index = parseInt(indexStr || '0');
    const result = await handleUploadChunk(session, index, data, isFinal, pageUrl, title);

    if (result) {
      return json({ id: result.id });
    }
    return json({ ok: true });
  } catch (error: any) {
    console.error('[POST /api/upload] error:', error);
    return json({ error: 'Upload failed: ' + (error?.message || String(error)) }, { status: 500 });
  }
}
