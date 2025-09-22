import { EventEmitter } from 'events';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { DOWNLOAD_DIR } from './config';

export type DownloadStatus = 'queued' | 'downloading' | 'completed' | 'failed' | 'canceled';

export type DownloadRecord = {
  id: string;
  url: string;
  title?: string;
  filename?: string;
  filePath?: string; // absolute path
  relPath?: string; // relative path under DOWNLOAD_DIR
  thumbnail?: string;
  format: 'mp3' | 'mp4';
  quality?: string;
  progress: number; // 0-100
  status: DownloadStatus;
  createdAt: number;
  updatedAt: number;
  error?: string;
};

export type DownloadEvent =
  | { type: 'snapshot'; downloads: DownloadRecord[] }
  | { type: 'update'; download: DownloadRecord }
  | { type: 'remove'; id: string };

class DownloadsManager extends EventEmitter {
  private items: Map<string, DownloadRecord> = new Map();

  constructor() {
    super();
    if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
  }

  list(): DownloadRecord[] {
    return Array.from(this.items.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  snapshot() {
    this.emit('event', { type: 'snapshot', downloads: this.list() } satisfies DownloadEvent);
  }

  add(input: Partial<DownloadRecord> & { url: string; format?: 'mp3' | 'mp4'; quality?: string }): DownloadRecord {
    const id = crypto.randomUUID();
    const now = Date.now();
    const rec: DownloadRecord = {
      id,
      url: input.url,
      format: input.format || 'mp4',
      quality: input.quality,
      progress: 0,
      status: 'queued',
      createdAt: now,
      updatedAt: now,
    };
    this.items.set(id, rec);
    this.emit('event', { type: 'update', download: rec } satisfies DownloadEvent);
    return rec;
  }

  update(id: string, patch: Partial<DownloadRecord>): DownloadRecord | undefined {
    const current = this.items.get(id);
    if (!current) return undefined;
    const updated = { ...current, ...patch, updatedAt: Date.now() } as DownloadRecord;
    this.items.set(id, updated);
    this.emit('event', { type: 'update', download: updated } satisfies DownloadEvent);
    return updated;
  }

  complete(id: string, patch: Partial<DownloadRecord> = {}) {
    return this.update(id, { ...patch, status: 'completed', progress: 100 });
  }

  fail(id: string, error?: string) {
    return this.update(id, { status: 'failed', error });
  }

  cancel(id: string) {
    const rec = this.items.get(id);
    if (!rec) return;
    this.update(id, { status: 'canceled' });
  }
}

export const downloadsManager = new DownloadsManager();
