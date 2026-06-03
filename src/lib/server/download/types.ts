export type DownloadStatus = 'queued' | 'downloading' | 'paused' | 'suspended' | 'completed' | 'failed' | 'canceled';
export type Format = 'mp3' | 'mp4' | 'webm' | 'mkv' | 'video-only';
export type VideoCodec = 'default' | 'h264' | 'hevc';

export interface DownloadRecord {
  id: string;
  url: string;
  title?: string;
  filename?: string;
  filePath?: string;
  relPath?: string;
  thumbnail?: string;
  format: Format;
  quality?: string;
  progress: number;
  status: DownloadStatus;
  createdAt: number;
  updatedAt: number;
  size?: number;
  downloaded?: number;
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
  downloadLyrics?: boolean;
  videoCodec?: VideoCodec;
  embedMetadata?: boolean;
  embedThumbnail?: boolean;
  category?: string;
  retryCount?: number;
  priority?: number;
}

export type DownloadEvent =
  | { type: 'snapshot'; downloads: DownloadRecord[]; stats?: { totalBytes: number; freeBytes: number } }
  | { type: 'update'; download: DownloadRecord }
  | { type: 'remove'; id: string }
  | { type: 'log'; id: string; message: string };

export interface EnqueueOptions {
  format?: Format;
  quality?: string;
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
  downloadLyrics?: boolean;
  videoCodec?: VideoCodec;
  embedMetadata?: boolean;
  embedThumbnail?: boolean;
  category?: string;
  processPlaylist?: boolean;
}

export interface DownloadFilter {
  status?: DownloadStatus | DownloadStatus[];
  url?: string;
  isFavorite?: boolean;
  category?: string;
  since?: number;
  until?: number;
}

export interface StorageStats {
  totalBytes: number;
  freeBytes: number;
}

export interface VideoMetadata {
  title: string;
  thumbnail?: string;
  duration?: number;
  description?: string;
  uploader?: string;
  id?: string;
}

export interface PlaylistItem {
  url: string;
  title: string;
  duration?: number;
  thumbnail?: string;
}

export type Unsubscribe = () => void;
