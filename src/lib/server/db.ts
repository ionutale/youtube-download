import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { DOWNLOAD_DIR } from './config';
import type { DownloadRecord } from './downloads';

const DB_PATH = path.join(DOWNLOAD_DIR, 'ytdl.db');
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
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
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);
CREATE INDEX IF NOT EXISTS idx_downloads_created ON downloads(createdAt);
`);

const upsertStmt = db.prepare(`INSERT INTO downloads (
  id,url,title,filename,filePath,relPath,thumbnail,format,quality,progress,status,createdAt,updatedAt,size,downloaded,speedBps,etaSeconds,durationSeconds,error
) VALUES (
  @id,@url,@title,@filename,@filePath,@relPath,@thumbnail,@format,@quality,@progress,@status,@createdAt,@updatedAt,@size,@downloaded,@speedBps,@etaSeconds,@durationSeconds,@error
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
  error=excluded.error
`);

export function dbUpsertDownload(rec: DownloadRecord) {
  upsertStmt.run(rec as any);
}

export function dbLoadDownloads(): DownloadRecord[] {
  const rows = db.prepare('SELECT * FROM downloads').all();
  return rows as DownloadRecord[];
}

export function dbCompletedHistory(): Array<{ title: string; path: string; thumbnail: string }> {
  const rows = db.prepare('SELECT title, relPath, thumbnail FROM downloads WHERE status = "completed" ORDER BY createdAt DESC').all() as Array<{ title: string; relPath: string; thumbnail?: string }>;
  return rows.map((r) => ({ title: r.title, path: `/${path.join('files', r.relPath)}`, thumbnail: r.thumbnail || '/favicon.png' }));
}

export function dbDeleteByRel(relPath: string) {
  db.prepare('DELETE FROM downloads WHERE relPath = ?').run(relPath);
}

// One-time migration from legacy JSON files
export function dbMigrateFromLegacy() {
  const legacyState = path.join(DOWNLOAD_DIR, 'downloads.json');
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
