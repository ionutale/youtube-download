import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import fs from 'fs';
import ytdl from 'ytdl-core';
import path from 'path';
import { get } from 'http';

const ROOT = path.resolve('.');
const DOWNLOAD_DIR = path.join(ROOT, 'download');

if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR);
}

const downloadProgress = {};

const getVideoInfo = async (url: string) => {
    return await ytdl.getInfo(url);
};


export const GET: RequestHandler = async ({ url }) => {
  try {

    const _url = url.searchParams.get('url');
    if (!_url) {
      throw error(400, 'URL parameter is missing.'); // Return error if URL is missing
    }
    
    const videInfo = await getVideoInfo(_url)
    console.log(videInfo);
    
    return json(videInfo);
  } catch (err) {
    throw error(500, "Internal Server Error");
  }           
};

