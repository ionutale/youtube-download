import { json } from '@sveltejs/kit';
import fs from 'fs';
import path from 'path';

const downloadDir = 'download';

export async function GET() {
	const files = fs.readdirSync(downloadDir);
	const history = files.map((file) => {
		const filePath = path.join(downloadDir, file);
		const stats = fs.statSync(filePath);
		return {
			title: file,
			path: `/${filePath}`,
			thumbnail: `/favicon.png` // Replace with actual thumbnail generation if needed
		};
	});
	return json(history);
}

export async function DELETE({ url }) {
	const filePath = url.searchParams.get('path');
	if (filePath) {
		fs.unlinkSync(path.join(process.cwd(), filePath));
	}
	return new Response(null, { status: 204 });
}
