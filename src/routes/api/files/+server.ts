import { json } from '@sveltejs/kit';
import { downloadsManager } from '$lib/server/downloads';
import fs from 'fs';

export async function GET() {
  try {
    const files = downloadsManager.list()
      .filter(d => d.status === 'completed' && d.filePath && fs.existsSync(d.filePath))
      .map(d => {
        let size = d.size || 0;
        let mtime = new Date(d.updatedAt);
        
        try {
          if (d.filePath) {
            const stats = fs.statSync(d.filePath);
            size = stats.size;
            mtime = stats.mtime;
          }
        } catch {}

        return {
          name: d.title || d.filename || 'Unknown',
          size: size,
          mtime: mtime,
          url: `/files/${d.relPath}`
        };
      });

    return json({ files });
  } catch (error) {
    console.error('Error listing files:', error);
    return json({ error: 'Failed to list files' }, { status: 500 });
  }
}
