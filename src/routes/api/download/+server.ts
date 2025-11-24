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
	const check = url.searchParams.get('check');
	
	if (check === 'true' && videoUrl) {
		const existing = downloadsManager.checkExists(videoUrl);
		return json({ exists: !!existing, id: existing?.id });
	}

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

export async function DELETE({ request }) {
	const body = await request.json().catch(() => ({}));
	const ids = body.ids;
	if (!Array.isArray(ids)) return json({ error: 'ids array required' }, { status: 400 });
	
	downloadsManager.delete(ids);
	return json({ success: true });
}

export async function POST({ request }) {
	const body = await request.json().catch(() => ({}));
	
	const videoUrl = body.url;
	const quality = body.quality || DEFAULT_QUALITY;
	const format = (body.format as 'mp3' | 'mp4') || DEFAULT_FORMAT;
	const filenamePattern = body.filenamePattern || undefined;
	const startTime = body.startTime || undefined;
	const endTime = body.endTime || undefined;
	const normalize = body.normalize === 'true' || body.normalize === true;
	const cookieContent = body.cookieContent || undefined;
	const proxyUrl = body.proxyUrl || undefined;
	const useSponsorBlock = body.useSponsorBlock === 'true' || body.useSponsorBlock === true;
	const downloadSubtitles = body.downloadSubtitles === 'true' || body.downloadSubtitles === true;
	const rateLimit = body.rateLimit || undefined;
	const organizeByUploader = body.organizeByUploader === 'true' || body.organizeByUploader === true;
	const splitChapters = body.splitChapters === 'true' || body.splitChapters === true;
	const downloadLyrics = body.downloadLyrics === 'true' || body.downloadLyrics === true;
	const videoCodec = body.videoCodec || 'default';
	const embedMetadata = body.embedMetadata !== false; // Default true
	const embedThumbnail = body.embedThumbnail !== false; // Default true
	const category = body.category || undefined;

	console.log('[POST /api/download] url=%s quality=%s format=%s', videoUrl, quality, format);
	if (!videoUrl) return json({ error: 'URL is required' }, { status: 400 });
	if (!/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(videoUrl)) {
		return json({ error: 'Only YouTube URLs are allowed' }, { status: 400 });
	}

	try {
		const records = await downloadsManager.enqueue({ 
			url: videoUrl, format, quality, filenamePattern, startTime, endTime, normalize,
			cookieContent, proxyUrl, useSponsorBlock, downloadSubtitles, rateLimit,
			organizeByUploader, splitChapters, downloadLyrics, videoCodec,
			embedMetadata, embedThumbnail, category
		});
		console.log('[POST /api/download] enqueued %d items', records.length);
		return json({ id: records[0].id, count: records.length });
	} catch (error: any) {
		console.error('[POST /api/download] enqueue error:', error);
		return json({ error: 'Failed to download video' }, { status: 500 });
	}
}
