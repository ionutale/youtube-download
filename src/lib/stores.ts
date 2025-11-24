import { writable } from 'svelte/store';
import type { HistoryItem, Notification } from '$lib/types';
import { browser } from '$app/environment';

export const history = writable<HistoryItem[]>([]);
export const notifications = writable<Notification[]>([]);

const defaultSettings = {
  filenamePattern: '{title}', // {title}, {id}, {uploader}, {date}
  theme: 'dark',
  notifications: true,
  cookieContent: '',
  proxyUrl: '',
  useSponsorBlock: false,
  downloadSubtitles: false,
  rateLimit: ''
};

const stored = browser ? JSON.parse(localStorage.getItem('settings') || '{}') : {};
export const settings = writable({ ...defaultSettings, ...stored });

if (browser) {
  settings.subscribe(v => localStorage.setItem('settings', JSON.stringify(v)));
}
