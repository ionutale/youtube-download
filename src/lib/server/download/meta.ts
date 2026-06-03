import type { VideoMetadata, PlaylistItem } from './types';
import { engine } from './engine';

export async function getVideoMetadata(url: string): Promise<VideoMetadata> {
  return engine.getMetadata(url);
}

export async function getPlaylistItems(url: string): Promise<PlaylistItem[]> {
  return engine.getPlaylistItems(url);
}
