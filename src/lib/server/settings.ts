import fs from 'fs';
import path from 'path';
import { DOWNLOAD_DIR, RETENTION_DAYS as ENV_RETENTION } from './config';

const SETTINGS_FILE = path.join(DOWNLOAD_DIR, 'settings.json');

export type ServerSettings = {
  retentionDays: number;
  webhookUrl?: string;
  scheduleEnabled?: boolean;
  scheduleStart?: string; // HH:mm
  scheduleEnd?: string; // HH:mm
  maxConcurrency: number;
  userAgent?: string;
  maxRetries: number;
};

const defaults: ServerSettings = {
  retentionDays: ENV_RETENTION,
  webhookUrl: '',
  scheduleEnabled: false,
  scheduleStart: '00:00',
  scheduleEnd: '06:00',
  maxConcurrency: 2,
  userAgent: '',
  maxRetries: 0
};

let cached: ServerSettings | null = null;

export function getServerSettings(): ServerSettings {
  if (cached) return cached;
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      cached = { ...defaults, ...JSON.parse(raw) };
    } else {
      cached = { ...defaults };
    }
  } catch {
    cached = { ...defaults };
  }
  return cached!;
}

export function updateServerSettings(patch: Partial<ServerSettings>) {
  const current = getServerSettings();
  const updated = { ...current, ...patch };
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2));
    cached = updated;
  } catch (e) {
    console.error('Failed to save settings', e);
  }
  return updated;
}
