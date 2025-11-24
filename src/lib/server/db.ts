import path from 'path';
import fs from 'fs';
import { DOWNLOAD_DIR } from './config';
import type { DownloadRecord } from './downloads';

let sqliteOk = false;
let sqliteApi: {
  upsert: (rec: DownloadRecord) => void;
  load: () => DownloadRecord[];
  completed: () => Array<{ title: string; path: string; thumbnail: string }>;
  deleteByRel: (rel: string) => void;
  migrate: () => void;
};

const JSON_STATE = path.join(DOWNLOAD_DIR, 'downloads.json');
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

try {
  // Native path
  const { default: Database } = await import('better-sqlite3');
  const DB_PATH = path.join(DOWNLOAD_DIR, 'ytdl.db');
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
CREATE TABLE IF NOT EXISTS downloads (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT,
  filename TEXT,
  filePath TEXT,
  relPath TEXT,
  thumbnail TEXT,
  format TEXT,
  quality TEXT,
  progress INTEGER,
  status TEXT,
  createdAt INTEGER,
  updatedAt INTEGER,
  size INTEGER,
  downloaded INTEGER,
  speedBps INTEGER,
  etaSeconds INTEGER,
  durationSeconds INTEGER,
  error TEXT,
  filenamePattern TEXT,
  startTime TEXT,
  endTime TEXT,
  normalize INTEGER,
  cookieContent TEXT,
  proxyUrl TEXT,
  useSponsorBlock INTEGER,
  downloadSubtitles INTEGER,
  rateLimit TEXT,
  organizeByUploader INTEGER,
  splitChapters INTEGER,
  isFavorite INTEGER
);
CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);
CREATE INDEX IF NOT EXISTS idx_downloads_created ON downloads(createdAt);
`);

  // Auto-migration for new columns
  const columns = [
    'filenamePattern TEXT', 'startTime TEXT', 'endTime TEXT', 'normalize INTEGER',
    'cookieContent TEXT', 'proxyUrl TEXT', 'useSponsorBlock INTEGER', 'downloadSubtitles INTEGER',
    'rateLimit TEXT', 'organizeByUploader INTEGER', 'splitChapters INTEGER', 'isFavorite INTEGER'
  ];
  for (const col of columns) {
    try { db.exec(`ALTER TABLE downloads ADD COLUMN ${col}`); } catch {}
  }

  const upsertStmt = db.prepare(`INSERT INTO downloads (
  id,url,title,filename,filePath,relPath,thumbnail,format,quality,progress,status,createdAt,updatedAt,size,downloaded,speedBps,etaSeconds,durationSeconds,error,
  filenamePattern,startTime,endTime,normalize,cookieContent,proxyUrl,useSponsorBlock,downloadSubtitles,rateLimit,organizeByUploader,splitChapters,isFavorite
) VALUES (
  @id,@url,@title,@filename,@filePath,@relPath,@thumbnail,@format,@quality,@progress,@status,@createdAt,@updatedAt,@size,@downloaded,@speedBps,@etaSeconds,@durationSeconds,@error,
  @filenamePattern,@startTime,@endTime,@normalize,@cookieContent,@proxyUrl,@useSponsorBlock,@downloadSubtitles,@rateLimit,@organizeByUploader,@splitChapters,@isFavorite
) ON CONFLICT(id) DO UPDATE SET
  url=excluded.url,
  title=excluded.title,
  filename=excluded.filename,
  filePath=excluded.filePath,
  relPath=excluded.relPath,
  thumbnail=excluded.thumbnail,
  format=excluded.format,
  quality=excluded.quality,
  progress=excluded.progress,
  status=excluded.status,
  createdAt=excluded.createdAt,
  updatedAt=excluded.updatedAt,
  size=excluded.size,
  downloaded=excluded.downloaded,
  speedBps=excluded.speedBps,
  etaSeconds=excluded.etaSeconds,
  durationSeconds=excluded.durationSeconds,
  error=excluded.error,
  filenamePattern=excluded.filenamePattern,
  startTime=excluded.startTime,
  endTime=excluded.endTime,
  normalize=excluded.normalize,
  cookieContent=excluded.cookieContent,
  proxyUrl=excluded.proxyUrl,
  useSponsorBlock=excluded.useSponsorBlock,
  downloadSubtitles=excluded.downloadSubtitles,
  rateLimit=excluded.rateLimit,
  organizeByUploader=excluded.organizeByUploader,
  splitChapters=excluded.splitChapters,
  isFavorite=excluded.isFavorite
`);

  sqliteApi = {
    upsert: (rec) => upsertStmt.run(rec as any),
    load: () => db.prepare('SELECT * FROM downloads').all() as DownloadRecord[],
    completed: () => {
      const rows = db
        .prepare('SELECT title, relPath, thumbnail FROM downloads WHERE status = "completed" ORDER BY createdAt DESC')
        .all() as Array<{ title: string; relPath: string; thumbnail?: string }>;
      return rows.map((r) => ({ title: r.title, path: `/${path.join('files', r.relPath)}`, thumbnail: r.thumbnail || '/favicon.png' }));
    },
    deleteByRel: (rel) => { db.prepare('DELETE FROM downloads WHERE relPath = ?').run(rel); },
    migrate: () => {
      const legacyState = JSON_STATE;
      try {
        if (fs.existsSync(legacyState)) {
          const arr = JSON.parse(fs.readFileSync(legacyState, 'utf-8')) as DownloadRecord[];
          const tx = db.transaction((items: DownloadRecord[]) => items.forEach((i) => upsertStmt.run(i as any)));
          tx(arr);
        }
      } catch {}
      try {
        const files = fs.readdirSync(DOWNLOAD_DIR).filter((f) => f.endsWith('.json') && f !== 'downloads.json');
        for (const meta of files) {
          const m = JSON.parse(fs.readFileSync(path.join(DOWNLOAD_DIR, meta), 'utf-8')) as { title: string; thumbnail?: string; path: string };
          const relPath = decodeURIComponent(m.path.replace(/^\/files\//, ''));
          const id = `legacy-${meta.replace(/\.json$/, '')}`;
          upsertStmt.run({
            id,
            url: '',
            title: m.title,
            filename: path.basename(relPath),
            filePath: path.join(DOWNLOAD_DIR, relPath),
            relPath,
            thumbnail: m.thumbnail,
            format: path.extname(relPath).toLowerCase() === '.mp3' ? 'mp3' : 'mp4',
            quality: null,
            progress: 100,
            status: 'completed',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            size: null,
            downloaded: null,
            speedBps: null,
            etaSeconds: null,
            durationSeconds: null,
            error: null
          } as any);
        }
      } catch {}
    }
  };
  sqliteOk = true;
} catch (e) {
  console.warn('[db] SQLite unavailable, using JSON fallback:', (e as any)?.message || e);
}

// Fallback JSON implementations
if (!sqliteOk) {
  sqliteApi = {
    upsert: (rec) => {
      const arr = fs.existsSync(JSON_STATE) ? (JSON.parse(fs.readFileSync(JSON_STATE, 'utf-8')) as DownloadRecord[]) : [];
      const idx = arr.findIndex((x) => x.id === rec.id);
      if (idx >= 0) arr[idx] = rec; else arr.push(rec);
      fs.writeFileSync(JSON_STATE, JSON.stringify(arr));
    },
    load: () => {
      if (!fs.existsSync(JSON_STATE)) return [];
      try { return JSON.parse(fs.readFileSync(JSON_STATE, 'utf-8')) as DownloadRecord[]; } catch { return []; }
    },
    completed: () => {
      const files = fs.readdirSync(DOWNLOAD_DIR).filter((f) => f.endsWith('.json') && f !== 'downloads.json');
      const out: Array<{ title: string; path: string; thumbnail: string }> = [];
      for (const meta of files) {
        try {
          const m = JSON.parse(fs.readFileSync(path.join(DOWNLOAD_DIR, meta), 'utf-8')) as { title: string; thumbnail?: string; path: string };
          out.push({ title: m.title, path: m.path, thumbnail: m.thumbnail || '/favicon.png' });
        } catch {}
      }
      return out;
    },
    deleteByRel: (rel) => {
      if (!fs.existsSync(JSON_STATE)) return;
      try {
        const arr = JSON.parse(fs.readFileSync(JSON_STATE, 'utf-8')) as DownloadRecord[];
        const filtered = arr.filter((x) => x.relPath !== rel);
        fs.writeFileSync(JSON_STATE, JSON.stringify(filtered));
      } catch {}
    },
    migrate: () => {}
  };
}

export function dbUpsertDownload(rec: DownloadRecord) { sqliteApi.upsert(rec); }
export function dbLoadDownloads(): DownloadRecord[] { return sqliteApi.load(); }
export function dbCompletedHistory(): Array<{ title: string; path: string; thumbnail: string }> { return sqliteApi.completed(); }
export function dbDeleteByRel(relPath: string) { sqliteApi.deleteByRel(relPath); }
export function dbMigrateFromLegacy() { sqliteApi.migrate(); }
