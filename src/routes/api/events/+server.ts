import type { RequestHandler } from '@sveltejs/kit';
import { downloadsManager } from '$lib/server/downloads';

export const GET: RequestHandler = async (event) => {
  let heartbeat: NodeJS.Timeout | undefined;
  let listener: ((evt: any) => void) | undefined;
  let abortHandler: (() => void) | undefined;

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

      listener = (evt: any) => send(evt);
      downloadsManager.on('event', listener);

      // Initial snapshot
      send({ type: 'snapshot', downloads: downloadsManager.list() });

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(`: ping\n\n`);
        } catch {
          // controller likely closed; cleanup will run in cancel
        }
      }, 15000);

      abortHandler = () => {
        try {
          controller.close();
        } catch {}
      };
      event.request.signal.addEventListener('abort', abortHandler);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (listener) downloadsManager.off('event', listener);
      if (abortHandler) event.request.signal.removeEventListener('abort', abortHandler);
        console.log('[GET /api/events] client disconnected');
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
