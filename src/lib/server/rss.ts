import { getServerSettings, updateServerSettings } from './settings';
import { checkExists } from './download/queries';
import { enqueue } from './download/commands';
import Parser from 'rss-parser';

const parser = new Parser();
let interval: NodeJS.Timeout | null = null;

export async function addRssFeed(url: string) {
  const settings = getServerSettings();
  const feeds = settings.rssFeeds || [];
  if (!feeds.includes(url)) {
    updateServerSettings({ rssFeeds: [...feeds, url] });
    await checkFeed(url); // Check immediately
  }
}

export function removeRssFeed(url: string) {
  const settings = getServerSettings();
  const feeds = settings.rssFeeds || [];
  updateServerSettings({ rssFeeds: feeds.filter(f => f !== url) });
}

export function getRssFeeds(): string[] {
  return getServerSettings().rssFeeds || [];
}

export async function checkFeed(url: string) {
  try {
    console.log(`[RSS] Checking feed: ${url}`);
    const feed = await parser.parseURL(url);
    // Process last 5 items
    const items = feed.items.slice(0, 5);

    for (const item of items) {
      if (item.link && (item.link.includes('youtube.com') || item.link.includes('youtu.be'))) {
        // Check if already downloaded
        const exists = checkExists(item.link);
        if (!exists) {
          console.log(`[RSS] Found new video: ${item.title}`);
          await enqueue(item.link, {
            format: 'mp4',
            quality: 'highest',
            category: 'RSS'
          });
        }
      }
    }
  } catch (e) {
    console.error(`[RSS] Failed to check feed ${url}`, e);
  }
}

export function startRssPoller() {
  if (interval) return;
  console.log('[RSS] Starting poller');

  // Check all feeds immediately
  const feeds = getRssFeeds();
  feeds.forEach(checkFeed);

  // Then every hour
  interval = setInterval(() => {
    const feeds = getRssFeeds();
    feeds.forEach(checkFeed);
  }, 60 * 60 * 1000);
}

export function stopRssPoller() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
