import { EventEmitter } from 'events';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { DEFAULT_FORMAT, DEFAULT_QUALITY, DOWNLOAD_DIR, MAX_CONCURRENCY } from './config';
import { getServerSettings } from './settings';
import { dbLoadDownloads, dbMigrateFromLegacy, dbUpsertDownload, dbDeleteByRel } from './db';
import { spawn } from 'child_process';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

// We rely on yt-dlp being available in the system (installed via Dockerfile)
const YTDLP_BIN = 'yt-dlp';

export type DownloadStatus = 'queued' | 'downloading' | 'paused' | 'completed' | 'failed' | 'canceled';

export type DownloadRecord = {
  id: string;
  url: string;
  title?: string;
  filename?: string;
  filePath?: string; // absolute path
  relPath?: string; // relative path under DOWNLOAD_DIR
  thumbnail?: string; // may be local /files/thumbnails/<name>
  format: 'mp3' | 'mp4' | 'webm' | 'mkv';
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
  filenamePattern?: string;
  startTime?: string;
  endTime?: string;
  normalize?: boolean;
  cookieContent?: string;
  proxyUrl?: string;
  useSponsorBlock?: boolean;
  downloadSubtitles?: boolean;
  rateLimit?: string;
  organizeByUploader?: boolean;
  splitChapters?: boolean;
  isFavorite?: boolean;
};

export type DownloadEvent =
  | { type: 'snapshot'; downloads: DownloadRecord[]; stats?: { totalBytes: number; freeBytes: number } }
  | { type: 'update'; download: DownloadRecord }
  | { type: 'remove'; id: string }
  | { type: 'log'; id: string; message: string };

type Controller = {
  process?: any;
  paused?: boolean;
};

class DownloadsManager extends EventEmitter {
  private items: Map<string, DownloadRecord> = new Map();
  private ctrls: Map<string, Controller> = new Map();
  private queue: string[] = [];
  private running = 0;
  private saveTimer?: NodeJS.Timeout;

  constructor() {
    super();
    if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    const th = path.join(DOWNLOAD_DIR, 'thumbnails');
    if (!fs.existsSync(th)) fs.mkdirSync(th, { recursive: true });

    try { dbMigrateFromLegacy(); console.log('[downloads] migration complete'); } catch (e) { console.warn('[downloads] migration error', e); }
    this.loadState();
    console.log('[downloads] loaded %d items from persistence', this.items.size);
    // requeue items that were in progress
    for (const rec of this.items.values()) {
      if (rec.status === 'queued' || rec.status === 'downloading' || rec.status === 'paused') {
        rec.status = 'queued';
        this.queue.push(rec.id);
      }
    }
    this.maybeRunNext();
    this.scheduleCleanup();
  }

  private scheduleCleanup() {
    const days = getServerSettings().retentionDays;
    if (days <= 0) return;
    console.log('[downloads] scheduling cleanup every 1h, retention=%d days', days);
    setInterval(() => this.cleanup(), 60 * 60 * 1000);
    this.cleanup(); // run once on startup
  }

  private cleanup() {
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
      
      // Delete file
      if (rec.filePath && fs.existsSync(rec.filePath)) {
        try { fs.unlinkSync(rec.filePath); } catch (e) { console.warn('failed to delete file', e); }
      }
      // Delete metadata json
      if (rec.relPath) {
        const metaPath = path.join(DOWNLOAD_DIR, rec.relPath.replace(/\.[^/.]+$/, '') + '.json');
        if (fs.existsSync(metaPath)) try { fs.unlinkSync(metaPath); } catch {}
      }
      // Delete thumbnail if local
      if (rec.thumbnail && rec.thumbnail.startsWith('/files/')) {
         const thumbPath = path.join(process.cwd(), rec.thumbnail.replace(/^\/files\//, 'download/')); // rough mapping
         // actually thumbnail path logic is a bit custom in cacheThumbnail, let's just try best effort or ignore for now
         // The thumbnail path in record is like /files/thumbnails/xyz.jpg
         // The actual path is download/thumbnails/xyz.jpg
         const localThumb = path.join(DOWNLOAD_DIR, 'thumbnails', path.basename(rec.thumbnail));
         if (fs.existsSync(localThumb)) try { fs.unlinkSync(localThumb); } catch {}
      }

      this.items.delete(id);
      if (rec.relPath) dbDeleteByRel(rec.relPath);
      this.emit('event', { type: 'remove', id } satisfies DownloadEvent);
    }
  }

  list(): DownloadRecord[] {
    return Array.from(this.items.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  snapshot() {
    this.emit('event', { type: 'snapshot', downloads: this.list(), stats: this.getStats() } satisfies DownloadEvent);
  }

  getStats() {
    let totalBytes = 0;
    let freeBytes = 0;
    try {
      // Calculate total size of download dir
      const files = fs.readdirSync(DOWNLOAD_DIR);
      for (const file of files) {
        try {
          const stat = fs.statSync(path.join(DOWNLOAD_DIR, file));
          if (stat.isFile()) totalBytes += stat.size;
        } catch {}
      }
      // Check free space (requires 'df' or similar, but let's just return used for now or use fs.statfs if node 18+)
      // Node 18.15+ has fs.statfsSync
      if ((fs as any).statfsSync) {
        const stats = (fs as any).statfsSync(DOWNLOAD_DIR);
        freeBytes = stats.bavail * stats.bsize;
      }
    } catch {}
    return { totalBytes, freeBytes };
  }

  public async getPlaylistItems(url: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      // --flat-playlist: do not download videos
      // --dump-single-json: output one JSON with "entries" array
      const args = ['--flat-playlist', '--dump-single-json', url];
      const proc = spawn(YTDLP_BIN, args);
      let stdout = '';
      proc.stdout.on('data', (d) => { stdout += d.toString(); });
      proc.on('close', (code) => {
        if (code !== 0) return resolve([]); // Not a playlist or error, treat as single
        try {
          const data = JSON.parse(stdout);
          if (data._type === 'playlist' && Array.isArray(data.entries)) {
             return resolve(data.entries.map((e: any) => e.url || e.original_url || `https://www.youtube.com/watch?v=${e.id}`));
          }
          resolve([]);
        } catch {
          resolve([]);
        }
      });
    });
  }

  async enqueue(input: { url: string; format?: 'mp3' | 'mp4' | 'webm' | 'mkv'; quality?: string; filenamePattern?: string; startTime?: string; endTime?: string; normalize?: boolean; cookieContent?: string; proxyUrl?: string; useSponsorBlock?: boolean; downloadSubtitles?: boolean; rateLimit?: string; organizeByUploader?: boolean; splitChapters?: boolean }): Promise<DownloadRecord[]> {
    // Check if playlist (only if not explicitly targeting a single video ID which usually doesn't have list= param, but let's just check)
    // Optimization: only check if URL contains 'list='
    if (input.url.includes('list=')) {
       const items = await this.getPlaylistItems(input.url);
       if (items.length > 0) {
         console.log('[downloads] expanding playlist with %d items', items.length);
         const records: DownloadRecord[] = [];
         for (const itemUrl of items) {
           // Recursively enqueue (but itemUrl won't have list= usually, or we strip it)
           // We must ensure we don't loop. getPlaylistItems returns video URLs.
           const [single] = await this.enqueue({ ...input, url: itemUrl });
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

  public async getMetadata(url: string): Promise<{ title: string; thumbnail?: string; duration?: number; description?: string; uploader?: string; id?: string }> {
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

  private async run(id: string) {
    const rec = this.items.get(id);
    if (!rec) return;
    this.running++;
    let cookiePath: string | undefined;

    try {
      console.log('[downloads] run start id=%s', id);
      this.update(id, { status: 'downloading', progress: 0, error: undefined });

      // Feature 8: Cookie Support
      if (rec.cookieContent) {
        cookiePath = path.join(DOWNLOAD_DIR, `cookies-${id}.txt`);
        fs.writeFileSync(cookiePath, rec.cookieContent);
      }

      // 1. Get Metadata
      let meta;
      try {
        // Pass cookies to metadata fetch if available
        // Note: getMetadata spawns a new process, we might need to update it to accept args or just rely on basic metadata
        // For now, let's assume basic metadata works without cookies or we accept failure.
        // Ideally we should pass cookies to getMetadata too.
        meta = await this.getMetadata(rec.url);
      } catch (e) {
        console.warn('[downloads] metadata failed, using defaults', e);
        meta = { title: 'download-' + id.slice(0, 8) };
      }

      // Feature 17: File Renaming Patterns
      let baseName = rec.filenamePattern || '{title}';
      baseName = baseName
        .replace('{title}', meta.title)
        .replace('{id}', meta.id || id)
        .replace('{uploader}', meta.uploader || 'unknown')
        .replace('{date}', new Date().toISOString().split('T')[0]);

      const safeTitle = baseName.replace(/[^a-zA-Z0-9-_]+/g, '_').slice(0, 120);
      const ext = rec.format === 'mp3' ? 'mp3' : rec.format;
      const filename = `${safeTitle}.${ext}`;
      
      // Feature 33: Folder Organization
      let targetDir = DOWNLOAD_DIR;
      if (rec.organizeByUploader && meta.uploader) {
        const safeUploader = meta.uploader.replace(/[^a-zA-Z0-9-_]+/g, '_').slice(0, 50);
        targetDir = path.join(DOWNLOAD_DIR, safeUploader);
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      }

      const absPath = path.join(targetDir, filename);
      const relPath = path.relative(DOWNLOAD_DIR, absPath);

      // Cache thumbnail
      const thumbLocal = await this.cacheThumbnail(meta.title, meta.thumbnail);
      this.update(id, {
        title: meta.title,
        thumbnail: thumbLocal || meta.thumbnail,
        filename,
        filePath: absPath,
        relPath
      });

      // 2. Download
      await new Promise<void>((resolve, reject) => {
        const args = ['--newline', '--no-colors']; // simplified output

        if (rec.format === 'mp3') {
          args.push('-x', '--audio-format', 'mp3');
          // Audio quality control (Feature #5)
          if (rec.quality && rec.quality !== 'highest') {
             // map '128', '192', '320' to --audio-quality
             // yt-dlp --audio-quality: 0 (best) to 9 (worst) or specific bitrate like 128K
             args.push('--audio-quality', rec.quality + 'K');
          }
        } else {
          // Video resolution control (Feature #4)
          let formatSpec = 'bv*+ba/b';
          if (rec.quality && rec.quality !== 'highest') {
             // e.g. quality='1080' -> height<=1080
             formatSpec = `bv*[height<=${rec.quality}]+ba/b[height<=${rec.quality}]`;
          }
          args.push('-f', formatSpec);
          args.push('--merge-output-format', rec.format);
        }

        args.push('-o', absPath);
        
        // Feature #11: Metadata Tagging
        args.push('--add-metadata');
        
        // Feature 15: Thumbnail Embedding
        args.push('--embed-thumbnail');

        // Feature 12: Video Trimming
        if (rec.startTime || rec.endTime) {
          const start = rec.startTime || '';
          const end = rec.endTime || '';
          args.push('--download-sections', `*${start}-${end}`);
          args.push('--force-keyframes-at-cuts');
        }

        // Feature 13: Volume Normalization
        if (rec.normalize) {
           args.push('--postprocessor-args', 'ffmpeg:-af loudnorm=I=-16:TP=-1.5:LRA=11');
        }

        // Feature 8: Cookies
        if (cookiePath) {
          args.push('--cookies', cookiePath);
        }

        // Feature 9: Proxy
        if (rec.proxyUrl) {
          args.push('--proxy', rec.proxyUrl);
        }

        // Feature 16: SponsorBlock
        if (rec.useSponsorBlock) {
          args.push('--sponsorblock-remove', 'all');
        }

        // Feature 3: Subtitles
        if (rec.downloadSubtitles) {
          args.push('--write-subs', '--write-auto-subs', '--sub-lang', 'en,.*', '--embed-subs');
        }

        // Feature 47: Rate Limit
        if (rec.rateLimit) {
          args.push('--limit-rate', rec.rateLimit);
        }

        // Feature 14: Chapter Splitting
        if (rec.splitChapters) {
          args.push('--split-chapters');
          // When splitting chapters, yt-dlp creates multiple files.
          // The output template needs to handle this, usually by appending chapter info.
          // We might need to adjust -o to include chapter index/title.
          // For now, let's just append chapter info to the filename template if not present.
          // Actually, if we use -o with a fixed filename, yt-dlp might overwrite or fail.
          // Let's modify the output template for chapters.
          // We need to remove the fixed filename and use a template that includes chapter info.
          // But we already resolved `absPath`.
          // If splitChapters is on, we should probably use a directory output or a template.
          // Let's try to append ` - %(section_number)03d - %(section_title)s` to the output template.
          // But `absPath` is fully resolved.
          // We need to change `args` to use a template instead of `absPath` if splitting.
          // Let's just append to the path before extension.
          const dir = path.dirname(absPath);
          const name = path.basename(absPath, path.extname(absPath));
          const ext = path.extname(absPath);
          // Override -o
          const newOutput = path.join(dir, `${name} - %(section_number)03d - %(section_title)s${ext}`);
          // Remove the previous -o
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

          // Parse progress: [download]  45.0% of 10.00MiB at 2.50MiB/s ETA 00:05
          const match = line.match(/\[download\]\s+(\d+(\.\d+)?)%/);
          if (match) {
            const pct = parseFloat(match[1]);
            this.update(id, { progress: pct });
          }
        });

        proc.stderr.on('data', (d) => {
             // yt-dlp sends some info to stderr
             const line = d.toString();
             if (!line.includes('WARNING')) console.log(`[yt-dlp stderr] ${line.trim()}`);
        });

        proc.on('error', reject);
        proc.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`yt-dlp exited with code ${code}`));
        });
      });

      // 3. Finalize
      const metadata = {
        title: meta.title,
        thumbnail: thumbLocal || meta.thumbnail,
        path: `/${path.join('files', relPath)}`
      };
      fs.writeFileSync(path.join(DOWNLOAD_DIR, safeTitle + '.json'), JSON.stringify(metadata));

      this.update(id, { status: 'completed', progress: 100 });
    } catch (e: any) {
      const msg = e?.message || String(e);
      console.error('[downloads] run error id=%s:', id, e);
      this.update(id, { status: 'failed', error: msg });
    } finally {
      this.ctrls.delete(id);
      if (cookiePath && fs.existsSync(cookiePath)) {
        try { fs.unlinkSync(cookiePath); } catch {}
      }
      this.running--;
      console.log('[downloads] run end id=%s running=%d queued=%d', id, this.running, this.queue.length);
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
      for (const rec of data) dbUpsertDownload(rec);
    } catch {}
  }

  private loadState() {
    try {
      const arr = dbLoadDownloads();
      for (const it of arr) this.items.set(it.id, it);
    } catch {}
  }

  async retry(id: string): Promise<DownloadRecord | undefined> {
    const rec = this.items.get(id);
    if (!rec) return undefined;
    const [newRec] = await this.enqueue({ url: rec.url, format: rec.format, quality: rec.quality });
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
    if (rec && rec.status === 'paused') {
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

  delete(ids: string[]) {
    for (const id of ids) {
      const rec = this.items.get(id);
      if (!rec) continue;
      
      // Stop if running
      this.cancel(id);

      // Delete files
      if (rec.filePath && fs.existsSync(rec.filePath)) {
        try { fs.unlinkSync(rec.filePath); } catch {}
      }
      if (rec.relPath) {
        const metaPath = path.join(DOWNLOAD_DIR, rec.relPath.replace(/\.[^/.]+$/, '') + '.json');
        if (fs.existsSync(metaPath)) try { fs.unlinkSync(metaPath); } catch {}
      }
      // Delete thumbnail if local
      if (rec.thumbnail && rec.thumbnail.startsWith('/files/')) {
         const localThumb = path.join(DOWNLOAD_DIR, 'thumbnails', path.basename(rec.thumbnail));
         if (fs.existsSync(localThumb)) try { fs.unlinkSync(localThumb); } catch {}
      }

      this.items.delete(id);
      if (rec.relPath) dbDeleteByRel(rec.relPath);
      this.emit('event', { type: 'remove', id } satisfies DownloadEvent);
    }
  }
}

export const downloadsManager = new DownloadsManager();
console.log('[downloads] using yt-dlp via spawn');
