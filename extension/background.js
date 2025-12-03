chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "sendToDownloader",
    title: "Download with YouTube Downloader",
    contexts: ["page", "link"],
    documentUrlPatterns: ["*://*.youtube.com/*", "*://youtu.be/*"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "sendToDownloader") {
    const url = info.linkUrl || info.pageUrl;
    const settings = await chrome.storage.sync.get({ serverUrl: 'http://localhost:5173', apiKey: '' });

    try {
      const res = await fetch(`${settings.serverUrl}/api/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': settings.apiKey
        },
        body: JSON.stringify({ url })
      });

      if (res.ok) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon48.png',
          title: 'Download Started',
          message: 'Video queued successfully'
        });
      } else {
        throw new Error('Server returned ' + res.status);
      }
    } catch (e) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'Download Failed',
        message: 'Could not connect to downloader: ' + e.message
      });
    }
  }
});
