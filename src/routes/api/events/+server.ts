import type { RequestHandler } from '@sveltejs/kit';
import { downloadsManager } from '$lib/server/downloads';

export const GET: RequestHandler = async () => {
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: any) => controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);

      const listener = (evt: any) => send(evt);
      downloadsManager.on('event', listener);

      // Initial snapshot
      send({ type: 'snapshot', downloads: downloadsManager.list() });

      const heartbeat = setInterval(() => controller.enqueue(`: ping\n\n`), 15000);

      return () => {
        clearInterval(heartbeat);
        downloadsManager.off('event', listener);
      };
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    }
  });
};
