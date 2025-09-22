import { EventEmitter } from 'events';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { DEFAULT_FORMAT, DEFAULT_QUALITY, DOWNLOAD_DIR, MAX_CONCURRENCY } from './config';
import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'child_process';
import ytdl from './ytdl';

export type DownloadStatus = 'queued' | 'downloading' | 'paused' | 'completed' | 'failed' | 'canceled';

export type DownloadRecord = {
  id: string;
  url: string;
  title?: string;
  filename?: string;
  filePath?: string; // absolute path
  relPath?: string; // relative path under DOWNLOAD_DIR
  thumbnail?: string; // may be local /files/thumbnails/<name>
  format: 'mp3' | 'mp4';
  quality?: string;
  progress: number; // 0-100
  status: DownloadStatus;
  createdAt: number;
  updatedAt: number;
  size?: number; // total bytes
  downloaded?: number; // bytes
  speedBps?: number;
  etaSeconds?: number;
  error?: string;
};

export type DownloadEvent =
  | { type: 'snapshot'; downloads: DownloadRecord[] }
  | { type: 'update'; download: DownloadRecord }
  | { type: 'remove'; id: string };

type Controller = {
  stream?: NodeJS.ReadableStream & { pause: () => void; resume: () => void; destroy: () => void };
  file?: fs.WriteStream;
  tempPath?: string;
  paused?: boolean;
};

class DownloadsManager extends EventEmitter {
  private items: Map<string, DownloadRecord> = new Map();
  private ctrls: Map<string, Controller> = new Map();
  private queue: string[] = [];
  private running = 0;
  private dbPath = path.join(DOWNLOAD_DIR, 'downloads.json');
  private saveTimer?: NodeJS.Timeout;

  constructor() {
    super();
    if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    const th = path.join(DOWNLOAD_DIR, 'thumbnails');
    if (!fs.existsSync(th)) fs.mkdirSync(th, { recursive: true });
    this.loadState();
    // requeue items that were in progress
    for (const rec of this.items.values()) {
      if (rec.status === 'queued' || rec.status === 'downloading' || rec.status === 'paused') {
        rec.status = 'queued';
        this.queue.push(rec.id);
      }
    }
    this.maybeRunNext();
  }

  list(): DownloadRecord[] {
    return Array.from(this.items.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  snapshot() {
    this.emit('event', { type: 'snapshot', downloads: this.list() } satisfies DownloadEvent);
  }

  enqueue(input: { url: string; format?: 'mp3' | 'mp4'; quality?: string }): DownloadRecord {
    const id = crypto.randomUUID();
    const now = Date.now();
    const rec: DownloadRecord = {
      id,
      url: input.url,
      format: input.format || DEFAULT_FORMAT,
      quality: input.quality || DEFAULT_QUALITY,
      progress: 0,
      status: 'queued',
      createdAt: now,
      updatedAt: now,
    };
    this.items.set(id, rec);
    this.queue.push(id);
    this.emit('event', { type: 'update', download: rec } satisfies DownloadEvent);
    this.maybeRunNext();
    return rec;
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

  private async cacheThumbnail(title: string, url?: string): Promise<string | undefined> {
    if (!url) return undefined;
    try {
      const safe = title.replace(/[^a-zA-Z0-9-_]+/g, '_').slice(0, 120);
      const file = path.join(DOWNLOAD_DIR, 'thumbnails', safe + '.jpg');
      const res = await fetch(url);
      if (!res.ok || !res.body) return undefined;
      const stream = fs.createWriteStream(file);
      await new Promise<void>((resolve, reject) => {
        (res.body as any).pipe(stream);
        stream.on('finish', () => resolve());
        stream.on('error', reject);
      });
      return `/${path.join('files', 'thumbnails', safe + '.jpg')}`;
    } catch {
      return undefined;
    }
  }

  private async run(id: string) {
    const rec = this.items.get(id);
    if (!rec) return;
    this.running++;
    try {
      this.update(id, { status: 'downloading' });
      const info = await (ytdl.getInfo ? ytdl.getInfo(rec.url) : (ytdl as any).getInfo(rec.url));
      const title = info.videoDetails.title as string;
      const thumbnails = info.videoDetails.thumbnails as Array<{ url: string }>;
      const safe = title.replace(/[^a-zA-Z0-9-_]+/g, '_').slice(0, 120);
  const ext = rec.format === 'mp3' ? 'mp3' : 'mp4';
      const relPath = safe + `.${ext}`;
      const absPath = path.join(DOWNLOAD_DIR, relPath);
      const tempPath = absPath + '.part';
      const thumbLocal = await this.cacheThumbnail(title, thumbnails?.[0]?.url);
      this.update(id, { title, filename: path.basename(absPath), filePath: absPath, relPath, thumbnail: thumbLocal || thumbnails?.[0]?.url });

      const chosen = (ytdl.chooseFormat ? ytdl.chooseFormat(info.formats, { quality: rec.quality }) : (ytdl as any).chooseFormat(info.formats, { quality: rec.quality }));
      const hasVideo = !!chosen.hasVideo;
      const hasAudio = !!chosen.hasAudio;
      const progressive = hasVideo && hasAudio && chosen.isHLS === false && chosen.isDashMPD === false;

      const file = fs.createWriteStream(tempPath);
      let stream: any;
      if (rec.format === 'mp4' && !progressive && ffmpegPath) {
        // Mux separate streams using ffmpeg
        const video = ytdl(rec.url, { quality: 'highestvideo' });
        const audio = ytdl(rec.url, { quality: 'highestaudio' });
        const proc = spawn(ffmpegPath, [
          '-y',
          '-i', 'pipe:3',
          '-i', 'pipe:4',
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-movflags', '+faststart',
          tempPath
        ], { stdio: ['ignore', 'inherit', 'inherit', 'pipe', 'pipe'] });
        // Pipe the two streams to ffmpeg
        (video as any).pipe(proc.stdio[3]);
        (audio as any).pipe(proc.stdio[4]);
        stream = proc;
        await new Promise<void>((resolve, reject) => {
          proc.on('error', reject);
          proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg mux exit ' + code))));
        });
      } else {
        // Progressive or mp3 flow (mp3 handled later)
        stream = ytdl(rec.url, { format: chosen });
        await new Promise<void>((resolve, reject) => {
          stream.on('error', reject);
          file.on('error', reject);
          file.on('finish', resolve);
          stream.pipe(file);
        });
      }
      this.ctrls.set(id, { stream, file, tempPath });

      let lastTime = Date.now();
      let lastBytes = 0;
      let total = Number(chosen.contentLength || 0);
      stream.on('progress', (_chunkLength: number, downloaded: number, tot: number) => {
        if (tot) total = tot;
        const now = Date.now();
        const dt = (now - lastTime) / 1000;
        const db = downloaded - lastBytes;
        const speed = dt > 0 ? db / dt : 0;
        const eta = speed > 0 && total ? Math.max(0, Math.round((total - downloaded) / speed)) : undefined;
        lastTime = now;
        lastBytes = downloaded;
        const pct = total ? Math.round((downloaded / total) * 100) : 0;
        this.update(id, { progress: pct, size: total, downloaded, speedBps: Math.round(speed), etaSeconds: eta });
      });

      if (rec.format === 'mp3' && ffmpegPath) {
        const mp3Path = absPath;
        const proc = spawn(ffmpegPath, ['-y', '-i', tempPath, '-vn', '-acodec', 'libmp3lame', mp3Path]);
        await new Promise<void>((resolve, reject) => {
          proc.on('error', reject);
          proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg exit ' + code))));
        });
        fs.unlinkSync(tempPath);
      } else {
        fs.renameSync(tempPath, absPath);
      }
      const metadata = { title, thumbnail: thumbLocal || thumbnails?.[0]?.url, path: `/${path.join('files', relPath)}` };
      fs.writeFileSync(path.join(DOWNLOAD_DIR, safe + '.json'), JSON.stringify(metadata));
      this.update(id, { status: 'completed', relPath, filePath: absPath, progress: 100 });
    } catch (e: any) {
      const msg = e?.message || String(e);
      this.update(id, { status: 'failed', error: msg });
    } finally {
      const c = this.ctrls.get(id);
      if (c?.tempPath && fs.existsSync(c.tempPath) && this.items.get(id)?.status !== 'completed') {
        try { fs.unlinkSync(c.tempPath); } catch {}
      }
      this.ctrls.delete(id);
      this.running--;
      this.maybeRunNext();
    }
  }

  private maybeRunNext() {
    while (this.running < MAX_CONCURRENCY && this.queue.length) {
      const next = this.queue.shift();
      if (next) this.run(next);
    }
  }

  private saveStateDebounced() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveState(), 100);
  }

  private saveState() {
    try {
      const data = Array.from(this.items.values());
      fs.writeFileSync(this.dbPath, JSON.stringify(data));
    } catch {}
  }

  private loadState() {
    try {
      if (!fs.existsSync(this.dbPath)) return;
      const arr = JSON.parse(fs.readFileSync(this.dbPath, 'utf-8')) as DownloadRecord[];
      for (const it of arr) this.items.set(it.id, it);
    } catch {}
  }

  retry(id: string): DownloadRecord | undefined {
    const rec = this.items.get(id);
    if (!rec) return undefined;
    return this.enqueue({ url: rec.url, format: rec.format, quality: rec.quality });
  }

  pause(id: string) {
    const ctrl = this.ctrls.get(id);
    if (ctrl && ctrl.stream && !ctrl.paused) {
      ctrl.stream.pause();
      ctrl.paused = true;
      this.update(id, { status: 'paused' });
    }
  }

  resume(id: string) {
    const ctrl = this.ctrls.get(id);
    if (ctrl && ctrl.stream && ctrl.paused) {
      ctrl.stream.resume();
      ctrl.paused = false;
      this.update(id, { status: 'downloading' });
    }
  }

  cancel(id: string) {
    const ctrl = this.ctrls.get(id);
    if (ctrl) {
      try { ctrl.stream?.destroy(); } catch {}
      try { ctrl.file?.close(); } catch {}
      if (ctrl.tempPath && fs.existsSync(ctrl.tempPath)) {
        try { fs.unlinkSync(ctrl.tempPath); } catch {}
      }
      this.ctrls.delete(id);
    } else {
      // if queued but not started
      const idx = this.queue.indexOf(id);
      if (idx >= 0) this.queue.splice(idx, 1);
    }
    this.update(id, { status: 'canceled' });
  }
}

export const downloadsManager = new DownloadsManager();
