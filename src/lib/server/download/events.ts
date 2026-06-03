import type { DownloadEvent, Unsubscribe } from './types';
import { engine } from './engine';

export function subscribe(handler: (event: DownloadEvent) => void): Unsubscribe {
  engine.on('event', handler);
  return () => {
    engine.off('event', handler);
  };
}
