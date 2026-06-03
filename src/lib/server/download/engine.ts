import { EventEmitter } from 'events';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { DEFAULT_FORMAT, DEFAULT_QUALITY, DOWNLOAD_DIR } from '../config';
import { getServerSettings } from '../settings';
import { dbLoadDownloads, dbMigrateFromLegacy, dbUpsertDownload, dbDeleteByRel } from '../db';
import { parseProgressLine, isScheduleAllowed, findExistingByUrl } from '../util';
import { spawn } from 'child_process';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import type { DownloadRecord, DownloadEvent, Format, StorageStats, VideoMetadata, PlaylistItem } from './types';

type Controller = {
  process?: any;
  paused?: boolean;
};

const YTDLP_BIN = 'yt-dlp';

export class DownloadEngine extends EventEmitter {
  private items: Map<string, DownloadRecord> = new Map();
  private ctrls: Map<string, Controller> = new Map();
  private queue: string[] = [];
  private running = 0;
  private saveTimer?: NodeJS.Timeout;
  private scheduleTimer?: NodeJS.Timeout;

  constructor() {
    super();
    if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    const th = path.join(DOWNLOAD_DIR, 'thumbnails');
    if (!fs.existsSync(th)) fs.mkdirSync(th, { recursive: true });
    this.init();
  }

  private async init() {
    try { await dbMigrateFromLegacy(); console.log('[downloads] migration complete'); } catch (e) { console.warn('[downloads] migration error', e); }
    await this.loadState();
    console.log('[downloads] loaded %d items from persistence', this.items.size);
    for (const rec of this.items.values()) {
      if (rec.status === 'queued' || rec.status === 'downloading' || rec.status === 'paused') {
        rec.status = 'queued';
        if (!this.queue.includes(rec.id)) this.queue.push(rec.id);
      }
    }
    this.maybeRunNext();
    this.scheduleCleanup();
    this.initScheduler();
  }

  private initScheduler() {
    this.scheduleTimer = setInterval(() => this.checkSchedule(), 60 * 1000);
    this.checkSchedule();
  }

  private checkSchedule() {
    const allowed = isScheduleAllowed(getServerSettings());
    if (allowed) {
      for (const [id, rec] of this.items.entries()) {
        if (rec.status === 'suspended') {
          console.log('[downloads] resuming suspended id=%s', id);
          this.update(id, { status: 'queued' });
          if (!this.queue.includes(id)) this.queue.push(id);
        }
      }
      this.maybeRunNext();
    } else {
      for (const [id, rec] of this.items.entries()) {
        if (rec.status === 'downloading') {
          console.log('[downloads] suspending id=%s due to schedule', id);
          const ctrl = this.ctrls.get(id);
          if (ctrl && ctrl.process) ctrl.process.kill('SIGTERM');
          this.update(id, { status: 'suspended' });
          this.running--;
        }
      }
    }
  }

  private scheduleCleanup() {
    const days = getServerSettings().retentionDays;
    if (days <= 0) return;
    console.log('[downloads] scheduling cleanup every 1h, retention=%d days', days);
    setInterval(() => this.cleanup(), 60 * 60 * 1000);
    this.cleanup();
  }

  private async cleanup() {
    const days = getServerSettings().retentionDays;
    if (days <= 0) return;
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    console.log('[downloads] running cleanup, cutoff=%s', new Date(cutoff).toISOString());

    const toDelete: string[] = [];
    for (const [id, rec] of this.items.entries()) {
      if (rec.status === 'completed' && rec.createdAt < cutoff) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      const rec = this.items.get(id);
      if (!rec) continue;
      console.log('[downloads] auto-cleanup deleting id=%s file=%s', id, rec.relPath);

      if (rec.filePath && fs.existsSync(rec.filePath)) {
        try { fs.unlinkSync(rec.filePath); } catch (e) { console.warn('failed to delete file', e); }
      }
      if (rec.relPath) {
        const metaPath = path.join(DOWNLOAD_DIR, rec.relPath.replace(/\.[^/.]+$/, '') + '.json');
        if (fs.existsSync(metaPath)) try { fs.unlinkSync(metaPath); } catch { }
      }
      if (rec.thumbnail && rec.thumbnail.startsWith('/files/')) {
        const localThumb = path.join(DOWNLOAD_DIR, 'thumbnails', path.basename(rec.thumbnail));
        if (fs.existsSync(localThumb)) try { fs.unlinkSync(localThumb); } catch { }
      }

      this.items.delete(id);
      if (rec.relPath) await dbDeleteByRel(rec.relPath);
      this.emit('event', { type: 'remove', id } satisfies DownloadEvent);
    }
  }

  list(): DownloadRecord[] {
    return Array.from(this.items.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  getById(id: string): DownloadRecord | undefined {
    return this.items.get(id);
  }

  snapshot() {
    this.emit('event', { type: 'snapshot', downloads: this.list(), stats: this.getStats() } satisfies DownloadEvent);
  }

  getStats(): StorageStats {
    let totalBytes = 0;
    let freeBytes = 0;
    try {
      const walk = (dir: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(fullPath);
          else if (entry.isFile()) totalBytes += fs.statSync(fullPath).size;
        }
      };
      walk(DOWNLOAD_DIR);
      if ((fs as any).statfsSync) {
        const stats = (fs as any).statfsSync(DOWNLOAD_DIR);
        freeBytes = stats.bavail * stats.bsize;
      }
    } catch { }
    return { totalBytes, freeBytes };
  }

  async getPlaylistItems(url: string): Promise<PlaylistItem[]> {
    return new Promise((resolve, reject) => {
      const args = ['--flat-playlist', '--dump-single-json', url];
      const proc = spawn(YTDLP_BIN, args);
      let stdout = '';
      proc.stdout.on('data', (d) => { stdout += d.toString(); });
      proc.on('close', (code) => {
        if (code !== 0) return resolve([]);
        try {
          const data = JSON.parse(stdout);
          if (data._type === 'playlist' && Array.isArray(data.entries)) {
            return resolve(data.entries.map((e: any) => ({
              url: e.url || e.original_url || `https://www.youtube.com/watch?v=${e.id}`,
              title: e.title || 'Unknown',
              duration: e.duration,
              thumbnail: e.thumbnails?.[0]?.url || undefined
            })));
          }
          resolve([]);
        } catch {
          resolve([]);
        }
      });
    });
  }

  checkExists(url: string): DownloadRecord | undefined {
    return findExistingByUrl(Array.from(this.items.values()), url);
  }

  async enqueue(input: { url: string; format?: Format; quality?: string; filenamePattern?: string; startTime?: string; endTime?: string; normalize?: boolean; cookieContent?: string; proxyUrl?: string; useSponsorBlock?: boolean; downloadSubtitles?: boolean; rateLimit?: string; organizeByUploader?: boolean; splitChapters?: boolean; downloadLyrics?: boolean; videoCodec?: 'default' | 'h264' | 'hevc'; embedMetadata?: boolean; embedThumbnail?: boolean; category?: string; processPlaylist?: boolean }): Promise<DownloadRecord[]> {
    if (input.url.includes('list=') && input.processPlaylist !== false) {
      const items = await this.getPlaylistItems(input.url);
      if (items.length > 0) {
        console.log('[downloads] expanding playlist with %d items', items.length);
        const records: DownloadRecord[] = [];
        for (const item of items) {
          const [single] = await this.enqueue({ ...input, url: item.url });
          records.push(single);
        }
        return records;
      }
    }

    const id = crypto.randomUUID();
    const now = Date.now();
    console.log('[downloads] enqueue id=%s url=%s format=%s quality=%s', id, input.url, input.format || DEFAULT_FORMAT, input.quality || DEFAULT_QUALITY);
    const rec: DownloadRecord = {
      id,
      url: input.url,
      format: (input.format as any) || DEFAULT_FORMAT,
      quality: input.quality || DEFAULT_QUALITY,
      filenamePattern: input.filenamePattern,
      startTime: input.startTime,
      endTime: input.endTime,
      normalize: input.normalize,
      cookieContent: input.cookieContent,
      proxyUrl: input.proxyUrl,
      useSponsorBlock: input.useSponsorBlock,
      downloadSubtitles: input.downloadSubtitles,
      rateLimit: input.rateLimit,
      organizeByUploader: input.organizeByUploader,
      splitChapters: input.splitChapters,
      downloadLyrics: input.downloadLyrics,
      videoCodec: input.videoCodec,
      embedMetadata: input.embedMetadata,
      embedThumbnail: input.embedThumbnail,
      category: input.category,
      retryCount: 0,
      priority: 0,
      progress: 0,
      status: 'queued',
      createdAt: now,
      updatedAt: now,
    };
    this.items.set(id, rec);
    this.queue.push(id);
    this.emit('event', { type: 'update', download: rec } satisfies DownloadEvent);
    this.maybeRunNext();
    return [rec];
  }

  update(id: string, patch: Partial<DownloadRecord>): DownloadRecord | undefined {
    const current = this.items.get(id);
    if (!current) return undefined;
    const updated = { ...current, ...patch, updatedAt: Date.now() } as DownloadRecord;
    this.items.set(id, updated);
    this.emit('event', { type: 'update', download: updated } satisfies DownloadEvent);
    this.saveStateDebounced();
    return updated;
  }

  setPriority(id: string, priority: number) {
    this.update(id, { priority });
  }

  getMetadata(url: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      const proc = spawn(YTDLP_BIN, ['--dump-json', url]);
      let stdout = '';
      proc.stdout.on('data', (d) => { stdout += d.toString(); });
      proc.on('close', (code) => {
        if (code !== 0) return reject(new Error(`yt-dlp dump-json exited with ${code}`));
        try {
          const data = JSON.parse(stdout);
          resolve({
            title: data.title || 'download',
            thumbnail: data.thumbnail,
            duration: data.duration,
            description: data.description,
            uploader: data.uploader,
            id: data.id
          });
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  private async cacheThumbnail(title: string, url?: string): Promise<string | undefined> {
    if (!url) return undefined;
    try {
      const safe = title.replace(/[^a-zA-Z0-9-_]+/g, '_').slice(0, 120);
      const file = path.join(DOWNLOAD_DIR, 'thumbnails', safe + '.jpg');
      if (fs.existsSync(file)) return `/${path.join('files', 'thumbnails', safe + '.jpg')}`;

      const res = await fetch(url);
      if (!res.ok || !res.body) return undefined;
      const stream = fs.createWriteStream(file);
      // @ts-ignore
      await pipeline(Readable.fromWeb(res.body as any), stream);
      return `/${path.join('files', 'thumbnails', safe + '.jpg')}`;
    } catch {
      return undefined;
    }
  }

  private async sendWebhook(rec: DownloadRecord) {
    const url = getServerSettings().webhookUrl;
    if (!url) return;

    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: rec.status === 'completed' ? 'download_complete' : 'download_failed',
          id: rec.id,
          title: rec.title,
          url: rec.url,
          status: rec.status,
          error: rec.error,
          path: rec.relPath ? `/files/${rec.relPath}` : undefined,
          thumbnail: rec.thumbnail
        })
      });
    } catch (e) {
      console.error('[downloads] webhook failed', e);
    }
  }

  private async run(id: string) {
    const rec = this.items.get(id);
    if (!rec) return;
    this.running++;
    let cookiePath: string | undefined;

    try {
      console.log('[downloads] run start id=%s', id);
      this.update(id, { status: 'downloading', progress: 0, error: undefined });

      if (rec.cookieContent) {
        cookiePath = path.join(DOWNLOAD_DIR, `cookies-${id}.txt`);
        fs.writeFileSync(cookiePath, rec.cookieContent);
      }

      let meta;
      try {
        meta = await this.getMetadata(rec.url);
      } catch (e) {
        console.warn('[downloads] metadata failed, using defaults', e);
        meta = { title: 'download-' + id.slice(0, 8) };
      }

      let baseName = rec.filenamePattern || '{title}';
      baseName = baseName
        .replace('{title}', meta.title)
        .replace('{id}', meta.id || id)
        .replace('{uploader}', meta.uploader || 'unknown')
        .replace('{date}', new Date().toISOString().split('T')[0]);

      const safeTitle = baseName.replace(/[^a-zA-Z0-9-_]+/g, '_').slice(0, 120);
      const ext = rec.format === 'mp3' ? 'mp3' : rec.format;
      const filename = `${safeTitle}.${ext}`;

      let targetDir = DOWNLOAD_DIR;
      if (rec.organizeByUploader && meta.uploader) {
        const safeUploader = meta.uploader.replace(/[^a-zA-Z0-9-_]+/g, '_').slice(0, 50);
        targetDir = path.join(DOWNLOAD_DIR, safeUploader);
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      }

      const absPath = path.join(targetDir, filename);
      const relPath = path.relative(DOWNLOAD_DIR, absPath);

      const thumbLocal = await this.cacheThumbnail(meta.title, meta.thumbnail);
      this.update(id, {
        title: meta.title,
        thumbnail: thumbLocal || meta.thumbnail,
        filename,
        filePath: absPath,
        relPath
      });

      await new Promise<void>((resolve, reject) => {
        const args = ['--newline', '--no-colors'];

        if (rec.format === 'mp3') {
          args.push('-x', '--audio-format', 'mp3');
          if (rec.quality && rec.quality !== 'highest') {
            args.push('--audio-quality', rec.quality + 'K');
          }
        } else if (rec.format === 'video-only') {
          let formatSpec = 'bv';
          if (rec.quality && rec.quality !== 'highest') {
            formatSpec = `bv[height<=${rec.quality}]`;
          }
          args.push('-f', formatSpec);
          args.push('--merge-output-format', 'mp4');
        } else {
          let formatSpec = 'bv*+ba/b';
          if (rec.quality && rec.quality !== 'highest') {
            formatSpec = `bv*[height<=${rec.quality}]+ba/b[height<=${rec.quality}]`;
          }
          args.push('-f', formatSpec);
          args.push('--merge-output-format', rec.format);
        }

        args.push('-o', absPath);

        if (rec.embedMetadata !== false) {
          args.push('--add-metadata');
        }

        if (rec.embedThumbnail !== false) {
          args.push('--embed-thumbnail');
        }

        if (rec.startTime || rec.endTime) {
          const start = rec.startTime || '';
          const end = rec.endTime || '';
          args.push('--download-sections', `*${start}-${end}`);
          args.push('--force-keyframes-at-cuts');
        }

        if (rec.normalize) {
          args.push('--postprocessor-args', 'ffmpeg:-af loudnorm=I=-16:TP=-1.5:LRA=11');
        }

        if (cookiePath) {
          args.push('--cookies', cookiePath);
        }

        if (rec.proxyUrl) {
          args.push('--proxy', rec.proxyUrl);
        }

        const ua = getServerSettings().userAgent;
        if (ua) {
          args.push('--user-agent', ua);
        }

        if (rec.useSponsorBlock) {
          args.push('--sponsorblock-remove', 'all');
        }

        if (rec.downloadSubtitles) {
          args.push('--write-subs', '--write-auto-subs', '--sub-lang', 'en,.*', '--embed-subs');
        }

        if (rec.downloadLyrics) {
          args.push('--write-lyrics');
        }

        if (rec.videoCodec && rec.videoCodec !== 'default') {
          if (rec.videoCodec === 'h264') {
            args.push('-S', 'vcodec:h264');
          } else if (rec.videoCodec === 'hevc') {
            args.push('-S', 'vcodec:h265');
          }
        }

        if (rec.rateLimit) {
          args.push('--limit-rate', rec.rateLimit);
        }

        if (rec.splitChapters) {
          args.push('--split-chapters');
          const dir = path.dirname(absPath);
          const name = path.basename(absPath, path.extname(absPath));
          const ext2 = path.extname(absPath);
          const newOutput = path.join(dir, `${name} - %(section_number)03d - %(section_title)s${ext2}`);
          const oIndex = args.indexOf('-o');
          if (oIndex >= 0) {
            args[oIndex + 1] = newOutput;
          }
        }

        args.push(rec.url);

        console.log('[downloads] spawning yt-dlp', args);
        const proc = spawn(YTDLP_BIN, args);
        this.ctrls.set(id, { process: proc });

        proc.stdout.on('data', (data) => {
          const line = data.toString();
          this.emit('event', { type: 'log', id, message: line } satisfies DownloadEvent);

          const parsed = parseProgressLine(line);
          if (parsed) {
            this.update(id, { progress: parsed.percent, speedBps: parsed.speedBps, etaSeconds: parsed.etaSeconds });
          }
        });

        proc.stderr.on('data', (d) => {
          const line = d.toString();
          if (!line.includes('WARNING')) console.log(`[yt-dlp stderr] ${line.trim()}`);
        });

        proc.on('error', reject);
        proc.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`yt-dlp exited with code ${code}`));
        });
      });

      const metadata = {
        title: meta.title,
        thumbnail: thumbLocal || meta.thumbnail,
        path: `/${path.join('files', relPath)}`
      };
      fs.writeFileSync(path.join(DOWNLOAD_DIR, safeTitle + '.json'), JSON.stringify(metadata));

      this.update(id, { status: 'completed', progress: 100 });

      try {
        const { uploadToCloud } = await import('../cloud');
        await uploadToCloud(absPath, relPath);
      } catch (e) {
        console.error('[downloads] cloud sync failed', e);
      }

      this.sendWebhook(this.items.get(id)!);
    } catch (e: any) {
      const msg = e?.message || String(e);
      console.error('[downloads] run error id=%s:', id, e);

      const rec2 = this.items.get(id);
      const maxRetries = getServerSettings().maxRetries || 0;

      if (rec2 && (rec2.retryCount || 0) < maxRetries) {
        const nextRetry = (rec2.retryCount || 0) + 1;
        console.log('[downloads] auto-retry id=%s attempt=%d/%d', id, nextRetry, maxRetries);
        this.update(id, { status: 'queued', retryCount: nextRetry, error: `Retrying (${nextRetry}/${maxRetries})... ${msg}` });
        this.queue.push(id);
      } else {
        this.update(id, { status: 'failed', error: msg });
        this.sendWebhook(this.items.get(id)!);
      }
    } finally {
      this.ctrls.delete(id);
      if (cookiePath && fs.existsSync(cookiePath)) {
        try { fs.unlinkSync(cookiePath); } catch { }
      }
      this.running--;
      console.log('[downloads] run end id=%s running=%d queued=%d', id, this.running, this.queue.length);
      this.maybeRunNext();
    }
  }

  private maybeRunNext() {
    if (!isScheduleAllowed(getServerSettings())) return;

    const limit = getServerSettings().maxConcurrency || 2;

    while (this.running < limit && this.queue.length) {
      let bestIdx = 0;
      let bestPriority = -Infinity;
      let bestCreatedAt = Infinity;

      for (let i = 0; i < this.queue.length; i++) {
        const id = this.queue[i];
        const rec = this.items.get(id);
        if (!rec) continue;
        const p = rec.priority || 0;
        if (p > bestPriority || (p === bestPriority && rec.createdAt < bestCreatedAt)) {
          bestPriority = p;
          bestCreatedAt = rec.createdAt;
          bestIdx = i;
        }
      }

      const next = this.queue.splice(bestIdx, 1)[0];
      if (next) this.run(next);
    }
  }

  private saveStateDebounced() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveState(), 100);
  }

  private async saveState() {
    try {
      const data = Array.from(this.items.values());
      for (const rec of data) await dbUpsertDownload(rec);
    } catch { }
  }

  private async loadState() {
    try {
      const arr = await dbLoadDownloads();
      for (const it of arr) this.items.set(it.id, it);
    } catch { }
  }

  async retry(id: string): Promise<DownloadRecord | undefined> {
    const rec = this.items.get(id);
    if (!rec) return undefined;
    const [newRec] = await this.enqueue({
      url: rec.url,
      format: rec.format,
      quality: rec.quality,
      filenamePattern: rec.filenamePattern,
      startTime: rec.startTime,
      endTime: rec.endTime,
      normalize: rec.normalize,
      cookieContent: rec.cookieContent,
      proxyUrl: rec.proxyUrl,
      useSponsorBlock: rec.useSponsorBlock,
      downloadSubtitles: rec.downloadSubtitles,
      rateLimit: rec.rateLimit,
      organizeByUploader: rec.organizeByUploader,
      splitChapters: rec.splitChapters,
      downloadLyrics: rec.downloadLyrics,
      videoCodec: rec.videoCodec,
      embedMetadata: rec.embedMetadata,
      embedThumbnail: rec.embedThumbnail,
      category: rec.category
    });
    return newRec;
  }

  pause(id: string) {
    const ctrl = this.ctrls.get(id);
    if (ctrl && ctrl.process) {
      ctrl.process.kill('SIGTERM');
      this.update(id, { status: 'paused' });
    }
  }

  resume(id: string) {
    const rec = this.items.get(id);
    if (rec && (rec.status === 'paused' || rec.status === 'suspended')) {
      this.queue.push(id);
      this.update(id, { status: 'queued' });
      this.maybeRunNext();
    }
  }

  cancel(id: string) {
    const ctrl = this.ctrls.get(id);
    if (ctrl && ctrl.process) {
      ctrl.process.kill('SIGKILL');
    }
    const idx = this.queue.indexOf(id);
    if (idx >= 0) this.queue.splice(idx, 1);
    this.update(id, { status: 'canceled' });
  }

  toggleFavorite(id: string) {
    const rec = this.items.get(id);
    if (rec) {
      this.update(id, { isFavorite: !rec.isFavorite });
    }
  }

  async deleteDownloads(ids: string[]) {
    for (const id of ids) {
      const rec = this.items.get(id);
      if (!rec) continue;

      this.cancel(id);

      if (rec.filePath && fs.existsSync(rec.filePath)) {
        try { fs.unlinkSync(rec.filePath); } catch { }
      }
      if (rec.relPath) {
        const metaPath = path.join(DOWNLOAD_DIR, rec.relPath.replace(/\.[^/.]+$/, '') + '.json');
        if (fs.existsSync(metaPath)) try { fs.unlinkSync(metaPath); } catch { }
      }
      if (rec.thumbnail && rec.thumbnail.startsWith('/files/')) {
        const localThumb = path.join(DOWNLOAD_DIR, 'thumbnails', path.basename(rec.thumbnail));
        if (fs.existsSync(localThumb)) try { fs.unlinkSync(localThumb); } catch { }
      }

      this.items.delete(id);
      if (rec.relPath) await dbDeleteByRel(rec.relPath);
      this.emit('event', { type: 'remove', id } satisfies DownloadEvent);
    }
  }
}

export const engine = new DownloadEngine();
console.log('[downloads] using yt-dlp via spawn');
