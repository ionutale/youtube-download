import type { DownloadRecord, EnqueueOptions } from './types';
import { engine } from './engine';

export async function enqueue(url: string, options?: EnqueueOptions): Promise<DownloadRecord[]> {
  return engine.enqueue({ url, ...options });
}

export function pause(id: string): void {
  engine.pause(id);
}

export function resume(id: string): void {
  engine.resume(id);
}

export function cancel(id: string): void {
  engine.cancel(id);
}

export async function retry(id: string): Promise<DownloadRecord | undefined> {
  return engine.retry(id);
}

export function setPriority(id: string, priority: number): void {
  engine.setPriority(id, priority);
}

export function toggleFavorite(id: string): void {
  engine.toggleFavorite(id);
}

export async function deleteDownloads(ids: string[]): Promise<void> {
  await engine.deleteDownloads(ids);
}
