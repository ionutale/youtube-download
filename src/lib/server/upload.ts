import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { DOWNLOAD_DIR, RECORDING_TEMP_DIR } from './config';
import { engine } from './download/engine';

interface RecordingSession {
  id: string;
  dir: string;
  chunkCount: number;
  pageUrl?: string;
  title?: string;
  createdAt: number;
}

const activeSessions = new Map<string, RecordingSession>();

function ensureTempDir() {
  if (!fs.existsSync(RECORDING_TEMP_DIR)) {
    fs.mkdirSync(RECORDING_TEMP_DIR, { recursive: true });
  }
}

export function handleUploadChunk(
  session: string,
  index: number,
  data: Buffer | undefined,
  isFinal: boolean,
  pageUrl?: string,
  title?: string
): Promise<{ id: string } | null> {
  ensureTempDir();

  let rec = activeSessions.get(session);
  if (!rec) {
    const dir = path.join(RECORDING_TEMP_DIR, session);
    fs.mkdirSync(dir, { recursive: true });
    rec = { id: session, dir, chunkCount: 0, pageUrl, title, createdAt: Date.now() };
    activeSessions.set(session, rec);
  }

  if (data) {
    const chunkPath = path.join(rec.dir, `${String(index).padStart(6, '0')}.webm`);
    fs.writeFileSync(chunkPath, data);
    rec.chunkCount = Math.max(rec.chunkCount, index + 1);
  }
  if (pageUrl) rec.pageUrl = pageUrl;
  if (title) rec.title = title;

  if (!isFinal) {
    return Promise.resolve(null);
  }

  return finalizeRecording(rec);
}

async function finalizeRecording(rec: RecordingSession): Promise<{ id: string }> {
  const chunks: string[] = [];
  for (let i = 0; i < rec.chunkCount; i++) {
    const chunkPath = path.join(rec.dir, `${String(i).padStart(6, '0')}.webm`);
    if (fs.existsSync(chunkPath)) {
      chunks.push(chunkPath);
    }
  }

  if (chunks.length === 0) {
    throw new Error('No chunks received for recording');
  }

  const concatPath = path.join(rec.dir, 'concat.txt');
  const concatContent = chunks.map(c => `file '${c.replace(/'/g, "'\\''")}'`).join('\n');
  fs.writeFileSync(concatPath, concatContent);

  const safeTitle = (rec.title || 'recording-' + rec.id.slice(0, 8))
    .replace(/[^a-zA-Z0-9-_]+/g, '_')
    .slice(0, 120);
  const outputFilename = `${safeTitle}.webm`;
  const outputPath = path.join(DOWNLOAD_DIR, outputFilename);

  try {
    await new Promise<void>((resolve, reject) => {
      const args = [
        '-f', 'concat',
        '-safe', '0',
        '-i', concatPath,
        '-c', 'copy',
        outputPath
      ];
      const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}`));
      });
      proc.on('error', reject);
    });
  } catch (e) {
    if (chunks.length === 1) {
      fs.copyFileSync(chunks[0], outputPath);
    } else {
      throw e;
    }
  }

  const id = crypto.randomUUID();
  const now = Date.now();
  const relPath = path.relative(DOWNLOAD_DIR, outputPath);

  engine.addDownload({
    id,
    url: rec.pageUrl || 'recording:' + rec.id,
    title: rec.title || safeTitle,
    format: 'mp4',
    quality: 'highest',
    progress: 100,
    status: 'completed',
    filename: outputFilename,
    filePath: outputPath,
    relPath,
    source: 'extension-recording',
    createdAt: now,
    updatedAt: now,
    priority: 0
  });

  fs.rmSync(rec.dir, { recursive: true, force: true });
  activeSessions.delete(rec.id);

  return { id };
}

export function cleanupStaleRecordings() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [session, rec] of activeSessions.entries()) {
    if (rec.createdAt < cutoff) {
      try { fs.rmSync(rec.dir, { recursive: true, force: true }); } catch { }
      activeSessions.delete(session);
    }
  }
  if (fs.existsSync(RECORDING_TEMP_DIR)) {
    for (const entry of fs.readdirSync(RECORDING_TEMP_DIR)) {
      const full = path.join(RECORDING_TEMP_DIR, entry);
      try {
        const stat = fs.statSync(full);
        if (stat.isDirectory() && stat.mtimeMs < cutoff) {
          fs.rmSync(full, { recursive: true, force: true });
        }
      } catch { }
    }
  }
}

export function getActiveRecordingSessions() {
  return Array.from(activeSessions.values()).map(s => ({
    id: s.id,
    chunkCount: s.chunkCount,
    title: s.title,
    createdAt: s.createdAt
  }));
}
