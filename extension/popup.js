document.getElementById('openSettings').addEventListener('click', () => {
  document.getElementById('main').style.display = 'none';
  document.getElementById('config').style.display = 'block';
});

document.getElementById('saveBtn').addEventListener('click', () => {
  const serverUrl = document.getElementById('serverUrl').value.replace(/\/$/, '');
  const apiKey = document.getElementById('apiKey').value;
  chrome.storage.sync.set({ serverUrl, apiKey }, () => {
    document.getElementById('config').style.display = 'none';
    document.getElementById('main').style.display = 'block';
  });
});

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get({ serverUrl: 'http://localhost:5173', apiKey: '' }, (items) => {
    document.getElementById('serverUrl').value = items.serverUrl;
    document.getElementById('apiKey').value = items.apiKey;
  });
});

document.getElementById('downloadBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    const settings = await chrome.storage.sync.get({ serverUrl: 'http://localhost:5173', apiKey: '' });
    try {
      const res = await fetch(`${settings.serverUrl}/api/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': settings.apiKey
        },
        body: JSON.stringify({ url: tab.url })
      });
      if (res.ok) {
        window.close();
      } else {
        alert('Failed: ' + res.status);
      }
    } catch (e) {
      alert('Error: ' + e.message);
    }
  }
});

document.getElementById('openBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    const settings = await chrome.storage.sync.get({ serverUrl: 'http://localhost:5173' });
    const serverUrl = settings.serverUrl.replace(/\/$/, '');
    const targetUrl = `${serverUrl}/?url=${encodeURIComponent(tab.url)}`;
    chrome.tabs.create({ url: targetUrl });
    window.close();
  }
});
