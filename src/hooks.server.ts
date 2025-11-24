import type { Handle } from '@sveltejs/kit';

const buckets = new Map<string, { tokens: number; ts: number }>();
const RATE = 10; // tokens per minute per IP

function rateLimit(ip: string) {
  const now = Date.now();
  const b = buckets.get(ip) || { tokens: RATE, ts: now };
  const elapsed = (now - b.ts) / 60000; // minutes
  b.tokens = Math.min(RATE, b.tokens + elapsed * RATE);
  b.ts = now;
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  buckets.set(ip, b);
  return true;
}

export const handle: Handle = async ({ event, resolve }) => {
  const method = event.request.method.toUpperCase();
  let ip = 'unknown';
  try {
    // getClientAddress may throw in Vite dev; guard it
    ip = event.getClientAddress?.() || 'unknown';
  } catch { }

  // Minimal request log for debugging
  try {
    console.log('[request]', method, event.url.pathname, 'ip=', ip);
  } catch { }

  if (['POST', 'PATCH', 'DELETE'].includes(method)) {
    // Same-origin/CSRF check for browsers: require Origin to match host if present
    const origin = event.request.headers.get('origin');
    if (origin) {
      const url = new URL(event.request.url);
      if (new URL(origin).host !== url.host) {
        return new Response('Forbidden', { status: 403 });
      }
    }
    if (!rateLimit(`${ip}:${method}`)) {
      return new Response('Too Many Requests', { status: 429 });
    }
  }

  // API Key Authentication
  if (event.url.pathname.startsWith('/api')) {
    const { validateApiKey, getApiKey } = await import('$lib/server/auth');
    const configuredKey = getApiKey();

    if (configuredKey) {
      const clientKey = event.request.headers.get('x-api-key');
      const referer = event.request.headers.get('referer');
      const host = event.url.host;

      const isUi = referer && new URL(referer).host === host;
      const isAuth = clientKey && validateApiKey(clientKey);

      if (!isUi && !isAuth) {
        return new Response('Unauthorized', { status: 401 });
      }
    }
  }

  return resolve(event);
};

// Start RSS Poller
import { startRssPoller } from '$lib/server/rss';
startRssPoller();
