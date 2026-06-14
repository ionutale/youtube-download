let detectedStreams = [];
let videoInfo = { count: 0, hasVideo: false };

function scanForVideoElements() {
  const videos = document.querySelectorAll('video');
  videoInfo = {
    count: videos.length,
    hasVideo: videos.length > 0,
    hasVideoSrc: Array.from(videos).some(v => v.src || v.querySelector('source[src]'))
  };
}

function scanForStreams() {
  try {
    const entries = performance.getEntriesByType('resource');
    for (const entry of entries) {
      const url = entry.name;
      if (url.match(/\.m3u8/i) || url.match(/\.mpd/i)) {
        if (!detectedStreams.includes(url)) {
          detectedStreams.push(url);
        }
      }
    }
  } catch (e) {
  }
}

function sendStatus() {
  chrome.runtime.sendMessage({
    type: 'videoDetected',
    data: {
      pageUrl: window.location.href,
      pageTitle: document.title,
      siteName: document.querySelector('meta[property="og:site_name"]')?.content ||
                document.querySelector('meta[name="application-name"]')?.content ||
                new URL(window.location.href).hostname,
      hasVideo: videoInfo.hasVideo,
      videoCount: videoInfo.count,
      streams: detectedStreams.slice(0, 10)
    }
  });
}

scanForVideoElements();
scanForStreams();
sendStatus();

const observer = new PerformanceObserver((list) => {
  let changed = false;
  for (const entry of list.getEntries()) {
    const url = entry.name;
    if (url.match(/\.m3u8/i) || url.match(/\.mpd/i)) {
      if (!detectedStreams.includes(url)) {
        detectedStreams.push(url);
        changed = true;
      }
    }
  }
  if (changed) sendStatus();
});
observer.observe({ entryTypes: ['resource'] });

const domObserver = new MutationObserver(() => {
  scanForVideoElements();
  sendStatus();
});
domObserver.observe(document.body, { childList: true, subtree: true });

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'getStatus') {
    scanForVideoElements();
    scanForStreams();
    sendStatus();
    sendResponse({ ok: true });
  }
});
