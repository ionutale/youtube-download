import { describe, expect, it } from 'vitest';
import { sanitizeName, parseProgressLine, isScheduleAllowed, findExistingByUrl, isValidUrl } from './util';
import type { DownloadRecord } from './download/types';

describe('sanitizeName', () => {
  it('replaces illegal chars and trims length', () => {
    const s = sanitizeName('a:/\\*?"<>| very long name !!!!!');
    expect(s).toMatch(/^[A-Za-z0-9-_]+(?:_[A-Za-z0-9-_]+)*$/);
    expect(s.length).toBeLessThanOrEqual(120);
  });
});

describe('parseProgressLine', () => {
  it('parses percent, speed and ETA from yt-dlp output', () => {
    const result = parseProgressLine('[download]  45.0% of 10.00MiB at 2.50MiB/s ETA 00:05');
    expect(result).toEqual({ percent: 45.0, speedBps: 2.5 * 1024 * 1024, etaSeconds: 5 });
  });

  it('parses 100% completion', () => {
    const result = parseProgressLine('[download] 100.0% of 10.00MiB at 5.00MiB/s ETA 00:00');
    expect(result).toEqual({ percent: 100.0, speedBps: 5 * 1024 * 1024, etaSeconds: 0 });
  });

  it('parses fractional percent', () => {
    const result = parseProgressLine('[download]  0.5% of 1.20GiB at 1.50MiB/s ETA 00:10');
    expect(result).toEqual({ percent: 0.5, speedBps: 1.5 * 1024 * 1024, etaSeconds: 10 });
  });

  it('handles KiB/s speed unit', () => {
    const result = parseProgressLine('[download]  50.0% of 1.00MiB at 500.00KiB/s ETA 00:30');
    expect(result).toEqual({ percent: 50.0, speedBps: 500 * 1024, etaSeconds: 30 });
  });

  it('returns null for non-progress lines', () => {
    const result = parseProgressLine('[download] Destination: /path/to/file.mp4');
    expect(result).toBeNull();
  });

  it('returns null for unrelated output', () => {
    const result = parseProgressLine('[youtube] Extracting URL: https://youtube.com/watch?v=123');
    expect(result).toBeNull();
  });
});

describe('isScheduleAllowed', () => {
  it('allows when schedule is disabled', () => {
    expect(isScheduleAllowed({ scheduleEnabled: false }, new Date('2026-06-02T12:00:00'))).toBe(true);
  });

  it('allows when within schedule window', () => {
    expect(isScheduleAllowed({ scheduleEnabled: true, scheduleStart: '08:00', scheduleEnd: '18:00' }, new Date('2026-06-02T12:00:00'))).toBe(true);
  });

  it('denies when outside schedule window', () => {
    expect(isScheduleAllowed({ scheduleEnabled: true, scheduleStart: '08:00', scheduleEnd: '18:00' }, new Date('2026-06-02T22:00:00'))).toBe(false);
  });

  it('allows during overnight schedule (past midnight)', () => {
    expect(isScheduleAllowed({ scheduleEnabled: true, scheduleStart: '22:00', scheduleEnd: '06:00' }, new Date('2026-06-02T23:00:00'))).toBe(true);
  });

  it('allows during overnight schedule (early morning)', () => {
    expect(isScheduleAllowed({ scheduleEnabled: true, scheduleStart: '22:00', scheduleEnd: '06:00' }, new Date('2026-06-03T04:00:00'))).toBe(true);
  });

  it('denies during overnight schedule (midday)', () => {
    expect(isScheduleAllowed({ scheduleEnabled: true, scheduleStart: '22:00', scheduleEnd: '06:00' }, new Date('2026-06-02T12:00:00'))).toBe(false);
  });

  it('defaults schedule to disabled and start/end to midnight when not set', () => {
    expect(isScheduleAllowed({}, new Date('2026-06-02T12:00:00'))).toBe(true);
  });
});

describe('findExistingByUrl', () => {
  const base: DownloadRecord = {
    id: '1', url: 'https://youtube.com/watch?v=abc', status: 'completed',
    format: 'mp4', progress: 100, createdAt: 1000, updatedAt: 1000
  };

  it('finds completed download by URL', () => {
    expect(findExistingByUrl([base], 'https://youtube.com/watch?v=abc')).toBeDefined();
  });

  it('finds queued download by URL', () => {
    const items = [base, { ...base, id: '2', status: 'queued' as const, url: 'https://youtube.com/watch?v=def' }];
    expect(findExistingByUrl(items, 'https://youtube.com/watch?v=def')).toBeDefined();
  });

  it('finds downloading download by URL', () => {
    const items = [base, { ...base, id: '3', status: 'downloading' as const, url: 'https://youtube.com/watch?v=ghi' }];
    expect(findExistingByUrl(items, 'https://youtube.com/watch?v=ghi')).toBeDefined();
  });

  it('finds failed download by URL', () => {
    const items = [base, { ...base, id: '4', status: 'failed' as const, url: 'https://youtube.com/watch?v=jkl' }];
    expect(findExistingByUrl(items, 'https://youtube.com/watch?v=jkl')).toBeDefined();
  });

  it('returns undefined for unknown URL', () => {
    expect(findExistingByUrl([base], 'https://youtube.com/watch?v=unknown')).toBeUndefined();
  });

  it('matches first record when URL appears multiple times', () => {
    const items = [
      { ...base, id: '5', status: 'queued' as const, url: 'https://youtube.com/watch?v=dup' },
      { ...base, id: '6', status: 'completed' as const, url: 'https://youtube.com/watch?v=dup' }
    ];
    const found = findExistingByUrl(items, 'https://youtube.com/watch?v=dup');
    expect(found?.id).toBe('5');
  });
});

describe('isValidUrl', () => {
  it('accepts YouTube URLs', () => {
    expect(isValidUrl('https://youtube.com/watch?v=abc123')).toBe(true);
    expect(isValidUrl('https://www.youtube.com/watch?v=abc123')).toBe(true);
    expect(isValidUrl('https://youtu.be/abc123')).toBe(true);
  });

  it('accepts Twitch URLs', () => {
    expect(isValidUrl('https://twitch.tv/videos/123456')).toBe(true);
    expect(isValidUrl('https://www.twitch.tv/example')).toBe(true);
  });

  it('accepts SoundCloud URLs', () => {
    expect(isValidUrl('https://soundcloud.com/artist/track')).toBe(true);
  });

  it('accepts arbitrary HTTP/HTTPS URLs', () => {
    expect(isValidUrl('https://vimeo.com/123456')).toBe(true);
    expect(isValidUrl('http://example.com/video')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isValidUrl('')).toBe(false);
  });
});
