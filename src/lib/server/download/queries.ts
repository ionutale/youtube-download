import type { DownloadRecord, DownloadFilter, StorageStats } from './types';
import { engine } from './engine';

export function list(filter?: DownloadFilter): DownloadRecord[] {
  let items = engine.list();
  if (filter) {
    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      items = items.filter(d => statuses.includes(d.status));
    }
    if (filter.url) {
      items = items.filter(d => d.url === filter.url);
    }
    if (filter.isFavorite !== undefined) {
      items = items.filter(d => d.isFavorite === filter.isFavorite);
    }
    if (filter.category) {
      items = items.filter(d => d.category === filter.category);
    }
    if (filter.since !== undefined) {
      items = items.filter(d => d.createdAt >= filter.since!);
    }
    if (filter.until !== undefined) {
      items = items.filter(d => d.createdAt <= filter.until!);
    }
  }
  return items;
}

export function getById(id: string): DownloadRecord | undefined {
  return engine.getById(id);
}

export function checkExists(url: string): DownloadRecord | undefined {
  return engine.checkExists(url);
}

export function getStats(): StorageStats {
  return engine.getStats();
}
