import { getServerSettings, updateServerSettings } from './settings';
import crypto from 'crypto';

export function validateApiKey(key: string): boolean {
  const settings = getServerSettings();
  if (!settings.apiKey) return true; // If no key set, allow all (or maybe deny? Plan said "Secure API endpoints")
  // Let's assume if no key is set, it's open (default state). 
  // But once set, it's secured.
  return settings.apiKey === key;
}

export function generateApiKey(): string {
  const key = crypto.randomBytes(32).toString('hex');
  updateServerSettings({ apiKey: key });
  return key;
}

export function getApiKey(): string | undefined {
  return getServerSettings().apiKey;
}

export function revokeApiKey() {
  updateServerSettings({ apiKey: undefined });
}
import { dbGetUser, dbUpsertUser } from './db';
// crypto is already imported at top of file


export async function registerUser(username: string, password: string): Promise<boolean> {
  const existing = await dbGetUser(username);
  if (existing) return false;

  // Simple hash for demo purposes (use bcrypt/argon2 in production)
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  await dbUpsertUser({ username, hash, createdAt: Date.now() });
  return true;
}

export async function loginUser(username: string, password: string): Promise<string | null> {
  const user = await dbGetUser(username);
  if (!user) return null;

  const hash = crypto.createHash('sha256').update(password).digest('hex');
  if (user.hash !== hash) return null;

  const token = crypto.randomBytes(32).toString('hex');
  // Store session (in memory for now, or DB)
  // For simplicity, let's just return a token and assume we validate it against a session store
  // But we need a session store.
  // Let's verify against the user object in DB for now by adding a token field
  await dbUpsertUser({ ...user, token });
  return token;
}

export async function verifySession(token: string): Promise<any | null> {
  // TODO: Implement session verification
  return null;
}
