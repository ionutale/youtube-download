import { json } from '@sveltejs/kit';
import { generateApiKey, revokeApiKey } from '$lib/server/auth';

export async function POST() {
  const key = generateApiKey();
  return json({ apiKey: key });
}

export async function DELETE() {
  revokeApiKey();
  return new Response(null, { status: 204 });
}
