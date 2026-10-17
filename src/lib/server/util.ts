import type { DownloadRecord } from './download/types';

export function sanitizeName(name: string) {
  return name.replace(/[^a-zA-Z0-9-_]+/g, '_').slice(0, 120);
}

export function isValidUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

// Removes playlist-scoped params (list, start_radio, index, ...) from a watch URL
// so yt-dlp downloads only the single video instead of paginating the whole mix.
export function stripPlaylistParams(url: string): string {
  try {
    const u = new URL(url);
    if (u.searchParams.has('list')) {
      for (const p of ['list', 'start_radio', 'index', 'continue']) u.searchParams.delete(p);
      return u.toString();
    }
    return url;
  } catch {
    return url;
  }
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
  const match = speed.match(/^([\d.]+)([KMG])?i?B\/s$/);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const prefix = match[2];
  if (prefix === 'K') return value * 1024;
  if (prefix === 'M') return value * 1024 * 1024;
  if (prefix === 'G') return value * 1024 * 1024 * 1024;
  return value;
}

function parseEta(eta: string): number | undefined {
  if (!/^\d+:\d+/.test(eta)) return undefined; // "Unknown", empty, etc.
  const parts = eta.split(':').map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return undefined;
}

export function parseProgressLine(line: string): { percent: number; speedBps: number; etaSeconds?: number } | null {
  // Standard in-flight line:  [download]  45.0% of 10.00MiB at 2.50MiB/s ETA 00:05
  // Fragmented (HLS/DASH):    [download]  20.8% of ~ 97.34MiB at 508.59KiB/s ETA 03:58 (frag 9/48)
  // Completion line:          [download] 100% of 10.00MiB in 00:00:03 at 748.29KiB/s
  const match = line.match(
    /^\[download\]\s+(\d+(?:\.\d+)?)%\s+of\s+(?:~?\s*)?\S+\s+(?:at\s+(\S+)\s+ETA\s+(\S+)|in\s+\S+\s+at\s+(\S+))(?:\s+\([^)]*\))?$/
  );
  if (!match) return null;
  const percent = parseFloat(match[1]);
  if (match[2] && match[3]) {
    return { percent, speedBps: parseSpeed(match[2]), etaSeconds: parseEta(match[3]) };
  }
  return { percent, speedBps: parseSpeed(match[4] || ''), etaSeconds: 0 };
}
