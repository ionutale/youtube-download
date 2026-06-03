import type { RequestHandler } from '@sveltejs/kit';
import { list } from '$lib/server/download/queries';
import { subscribe } from '$lib/server/download/events';

export const GET: RequestHandler = async (event) => {
  console.log('[GET /api/events] client connected');

  const stream = new ReadableStream<string>({
    start(controller) {
      const send = (data: any) => {
        try {
          controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
        } catch {
          // no-op if controller already closed
        }
      };

      send({ type: 'snapshot', downloads: list() });

      const unsub = subscribe((evt) => send(evt));

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(`: ping\n\n`);
        } catch {
          // controller likely closed; cleanup will run in cancel
        }
      }, 15000);

      event.request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        unsub();
        try { controller.close(); } catch {}
        console.log('[GET /api/events] client disconnected');
      });
    },
    cancel() {
      // cleanup handled in abort handler
    }
  });

  return new Response(stream as any, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    }
  });
};
