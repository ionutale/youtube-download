import { json } from '@sveltejs/kit';
import fs from 'fs';
import path from 'path';
import { downloadsManager } from '$lib/server/downloads';
import { DEFAULT_FORMAT, DEFAULT_QUALITY, DOWNLOAD_DIR } from '$lib/server/config';

function sanitizeName(name: string) {
	return name.replace(/[^a-zA-Z0-9-_]+/g, '_').slice(0, 120);
}

export async function GET({ url }) {
	const videoUrl = url.searchParams.get('url');
	const quality = url.searchParams.get('quality') || DEFAULT_QUALITY;
	console.log('[GET /api/download] url=%s quality=%s', videoUrl, quality);
	if (!videoUrl) return json({ error: 'URL is required' }, { status: 400 });
	if (!/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(videoUrl)) {
		return json({ error: 'Only YouTube URLs are allowed' }, { status: 400 });
	}
	try {
		const info = await downloadsManager.getMetadata(videoUrl);
		const title = info.title;
		const thumbnails = info.thumbnail ? [{ url: info.thumbnail }] : [];
		console.log('[GET /api/download] info ok title=%s', title);
		return json({ title, lengthSeconds: info.duration, description: info.description, thumbnails, quality });
	} catch (e) {
		console.error('[GET /api/download] info error:', e);
		return json({ error: 'Failed to fetch info' }, { status: 500 });
	}
}

export async function POST({ url }) {
	const videoUrl = url.searchParams.get('url');
	const quality = url.searchParams.get('quality') || DEFAULT_QUALITY;
	const format = (url.searchParams.get('format') as 'mp3' | 'mp4') || DEFAULT_FORMAT;
	const filenamePattern = url.searchParams.get('filenamePattern') || undefined;
	const startTime = url.searchParams.get('startTime') || undefined;
	const endTime = url.searchParams.get('endTime') || undefined;
	const normalize = url.searchParams.get('normalize') === 'true';

	console.log('[POST /api/download] url=%s quality=%s format=%s', videoUrl, quality, format);
	if (!videoUrl) return json({ error: 'URL is required' }, { status: 400 });
	if (!/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(videoUrl)) {
		return json({ error: 'Only YouTube URLs are allowed' }, { status: 400 });
	}

	try {
		const records = await downloadsManager.enqueue({ url: videoUrl, format, quality, filenamePattern, startTime, endTime, normalize });
		console.log('[POST /api/download] enqueued %d items', records.length);
		return json({ id: records[0].id, count: records.length });
	} catch (error: any) {
		console.error('[POST /api/download] enqueue error:', error);
		return json({ error: 'Failed to download video' }, { status: 500 });
	}
}
