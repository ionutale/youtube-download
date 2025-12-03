import { json } from '@sveltejs/kit';
import { registerUser, loginUser } from '$lib/server/auth';

export async function POST({ request, url }) {
  const { username, password } = await request.json();

  if (url.pathname.endsWith('/register')) {
    const success = await registerUser(username, password);
    if (!success) return json({ error: 'User exists' }, { status: 400 });
    return json({ success: true });
  } else {
    const token = await loginUser(username, password);
    if (!token) return json({ error: 'Invalid credentials' }, { status: 401 });
    return json({ token });
  }
}
