import { json } from '@sveltejs/kit';
import { downloadsManager } from '$lib/server/downloads';
import { getServerSettings, updateServerSettings } from '$lib/server/settings';
import { DOWNLOAD_DIR } from '$lib/server/config';
import os from 'os';
import path from 'path';

export async function GET() {
  const stats = downloadsManager.getStats();
  const settings = getServerSettings();
  
  const system = {
    memory: {
      total: os.totalmem(),
      free: os.freemem(),
    },
    uptime: os.uptime(),
    platform: os.platform() + ' ' + os.release(),
    cpus: os.cpus().length,
    downloadDir: path.resolve(DOWNLOAD_DIR)
  };

  return json({ stats, settings, system });
}

export async function POST({ request }) {
  const body = await request.json().catch(() => ({}));
  const updated = updateServerSettings(body);
  return json(updated);
}
