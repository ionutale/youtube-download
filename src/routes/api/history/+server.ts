import { json } from '@sveltejs/kit';
import fs from 'fs';
import path from 'path';
import { DOWNLOAD_DIR } from '$lib/server/config';

export async function GET() {
	const entries = fs.readdirSync(DOWNLOAD_DIR);
	const items = entries
		.filter((f) => f.endsWith('.json'))
		.map((meta) => {
			const metaPath = path.join(DOWNLOAD_DIR, meta);
			try {
				const data = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as { title: string; thumbnail?: string; path: string };
				return { title: data.title, path: data.path, thumbnail: data.thumbnail || '/favicon.png' };
			} catch {
				return null;
			}
		})
		.filter(Boolean);
	return json(items);
}

export async function DELETE({ url }) {
	const rel = url.searchParams.get('rel');
	if (!rel) return new Response(null, { status: 400 });
	const safeRel = rel.replace(/\\|\.\.|^\//g, '');
	const abs = path.join(DOWNLOAD_DIR, safeRel);
	if (!abs.startsWith(DOWNLOAD_DIR)) return new Response('Forbidden', { status: 403 });
	try {
		if (fs.existsSync(abs)) fs.unlinkSync(abs);
		const base = abs.replace(/\.[^.]+$/, '');
		const meta = base + '.json';
		if (fs.existsSync(meta)) fs.unlinkSync(meta);
	} catch {
		return new Response(null, { status: 500 });
	}
	return new Response(null, { status: 204 });
}
