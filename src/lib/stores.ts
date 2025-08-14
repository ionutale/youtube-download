import { writable } from 'svelte/store';
import type { HistoryItem, Notification } from '$lib/types';

export const history = writable<HistoryItem[]>([]);
export const notifications = writable<Notification[]>([]);
