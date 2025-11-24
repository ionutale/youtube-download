import { json } from '@sveltejs/kit';
import fs from 'fs';
import { DOWNLOAD_DIR } from '$lib/server/config';

export async function GET() {
  try {
    // Check if download dir is writable
    fs.accessSync(DOWNLOAD_DIR, fs.constants.W_OK);
    return json({ status: 'ok' });
  } catch (e) {
    return json({ status: 'error', message: 'Download directory not writable' }, { status: 500 });
  }
}
