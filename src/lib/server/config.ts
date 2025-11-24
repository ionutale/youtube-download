import { env } from '$env/dynamic/private';
import path from 'path';

export const DOWNLOAD_DIR = env.DOWNLOAD_DIR || path.join(process.cwd(), 'download');
export const MAX_CONCURRENCY = Number(env.MAX_CONCURRENCY || 2);
export const PROGRESS_INTERVAL_MS = Number(env.PROGRESS_INTERVAL_MS || 200);
export const DEFAULT_QUALITY = env.DEFAULT_QUALITY || 'highest';
export const DEFAULT_FORMAT = (env.DEFAULT_FORMAT || 'mp4') as 'mp3' | 'mp4';
export const RETENTION_DAYS = Number(env.RETENTION_DAYS || 0); // 0 = disabled

