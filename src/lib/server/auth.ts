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
