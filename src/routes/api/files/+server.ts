import { json } from '@sveltejs/kit';
import fs from 'fs';
import path from 'path';
import { DOWNLOAD_DIR } from '$lib/server/config';

export async function GET() {
  try {
    if (!fs.existsSync(DOWNLOAD_DIR)) {
      return json({ files: [] });
    }

    const files = fs.readdirSync(DOWNLOAD_DIR)
      .filter(file => !file.startsWith('.') && !file.endsWith('.json') && !file.endsWith('.part') && fs.statSync(path.join(DOWNLOAD_DIR, file)).isFile())
      .map(file => {
        const stats = fs.statSync(path.join(DOWNLOAD_DIR, file));
        return {
          name: file,
          size: stats.size,
          mtime: stats.mtime,
          url: `/files/${encodeURIComponent(file)}`
        };
      })
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    return json({ files });
  } catch (error) {
    console.error('Error listing files:', error);
    return json({ error: 'Failed to list files' }, { status: 500 });
  }
}
