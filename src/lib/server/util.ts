import type { DownloadRecord } from './download/types';

export function sanitizeName(name: string) {
  return name.replace(/[^a-zA-Z0-9-_]+/g, '_').slice(0, 120);
}

export function isValidUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

export function findExistingByUrl(items: DownloadRecord[], url: string): DownloadRecord | undefined {
  return items.find(rec => rec.url === url);
}

export function isScheduleAllowed(
  settings: { scheduleEnabled?: boolean; scheduleStart?: string; scheduleEnd?: string },
  now?: Date
): boolean {
  if (!settings.scheduleEnabled) return true;

  const start = settings.scheduleStart || '00:00';
  const end = settings.scheduleEnd || '06:00';
  const d = now || new Date();
  const current = d.getHours() * 60 + d.getMinutes();

  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const sMin = sh * 60 + sm;
  const eMin = eh * 60 + em;

  if (sMin < eMin) {
    return current >= sMin && current < eMin;
  }
  return current >= sMin || current < eMin;
}

function parseSpeed(speed: string): number {
  const match = speed.match(/^([\d.]+)([KMG])iB\/s$/);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const prefix = match[2];
  if (prefix === 'K') return value * 1024;
  if (prefix === 'M') return value * 1024 * 1024;
  if (prefix === 'G') return value * 1024 * 1024 * 1024;
  return value;
}

export function parseProgressLine(line: string): { percent: number; speedBps: number; etaSeconds: number } | null {
  const match = line.match(/^\[download\]\s+(\d+(?:\.\d+)?)%\s+of\s+\S+\s+at\s+(\S+)\s+ETA\s+(\d+):(\d+)$/);
  if (!match) return null;
  return {
    percent: parseFloat(match[1]),
    speedBps: parseSpeed(match[2]),
    etaSeconds: parseInt(match[3]) * 60 + parseInt(match[4])
  };
}
