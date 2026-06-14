let recordingStartTime = null;
let recordingTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  const serverUrl = document.getElementById('serverUrl');
  const apiKey = document.getElementById('apiKey');

  chrome.storage.sync.get({ serverUrl: 'http://localhost:5173', apiKey: '' }, (items) => {
    serverUrl.value = items.serverUrl;
    apiKey.value = items.apiKey;
  });

  document.getElementById('saveBtn').addEventListener('click', () => {
    chrome.storage.sync.set({
      serverUrl: serverUrl.value.replace(/\/$/, ''),
      apiKey: apiKey.value
    }, () => {
      document.getElementById('configArea').style.display = 'none';
      document.getElementById('main').style.display = 'block';
    });
  });

  document.getElementById('configBtn').addEventListener('click', () => {
    document.getElementById('main').style.display = 'none';
    document.getElementById('configArea').style.display = 'block';
  });

  document.getElementById('backBtn').addEventListener('click', () => {
    document.getElementById('configArea').style.display = 'none';
    document.getElementById('main').style.display = 'block';
  });

  document.getElementById('openBtn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      chrome.storage.sync.get({ serverUrl: 'http://localhost:5173' }, (items) => {
        const base = items.serverUrl.replace(/\/$/, '');
        chrome.tabs.create({ url: `${base}/?url=${encodeURIComponent(tab.url)}` });
      });
    }
    window.close();
  });

  // Get current status from background
  chrome.runtime.sendMessage({ type: 'getPopupStatus' }, (response) => {
    if (response) {
      updateUI(response);
    } else {
      queryActiveTab();
    }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'popupStatus') {
      updateUI(msg.data);
    }
  });
});

async function queryActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'getStatus' });
  } catch (e) {
  }
}

function updateUI(data) {
  const statusText = document.getElementById('statusText');
  const statusIcon = document.getElementById('statusIcon');
  const streamList = document.getElementById('streamList');
  const downloadBtn = document.getElementById('downloadBtn');
  const recordBtn = document.getElementById('recordBtn');
  const recordingArea = document.getElementById('recordingArea');
  const pageInfo = document.getElementById('pageInfo');

  pageInfo.textContent = data?.pageTitle ? `${data.pageTitle}` : '';

  if (data?.streams && data.streams.length > 0) {
    statusIcon.className = 'status-icon icon-dl';
    statusText.textContent = `Found ${data.streams.length} video stream(s)`;
    streamList.innerHTML = data.streams.map(s => `<div class="stream-item">stream: ${s.split('/').pop()?.slice(0, 50)}</div>`).join('');

    downloadBtn.style.display = 'block';
    recordBtn.style.display = 'none';
    recordingArea.style.display = 'none';

    downloadBtn.onclick = () => {
      downloadBtn.disabled = true;
      downloadBtn.textContent = 'Sending...';
      chrome.runtime.sendMessage({
        type: 'captureStream',
        data: { url: data.streams[0], pageUrl: data.pageUrl, title: data.pageTitle }
      }, () => {
        window.close();
      });
    };
  } else if (data?.hasVideo) {
    statusIcon.className = 'status-icon icon-rec';
    statusText.textContent = 'Video detected (no stream URL found)';
    streamList.innerHTML = '<div class="stream-item">Recording available for DRM content</div>';

    downloadBtn.style.display = 'none';
    recordBtn.style.display = 'block';
    recordingArea.style.display = 'none';

    recordBtn.onclick = () => {
      recordBtn.style.display = 'none';
      recordingArea.style.display = 'block';
      recordingStartTime = Date.now();
      updateTimerDisplay();
      recordingTimer = setInterval(updateTimerDisplay, 1000);
      chrome.runtime.sendMessage({
        type: 'startRecording',
        data: { pageUrl: data.pageUrl, title: data.pageTitle, tabId: null }
      });
    };
  } else {
    statusIcon.className = 'status-icon icon-idle';
    statusText.textContent = 'No video detected on this page';
    streamList.innerHTML = '';
    downloadBtn.style.display = 'none';
    recordBtn.style.display = 'none';
    recordingArea.style.display = 'none';
  }
}

document.getElementById('stopBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'stopRecording' });
  if (recordingTimer) clearInterval(recordingTimer);
  recordingTimer = null;
  document.getElementById('recordingArea').style.display = 'none';
  document.getElementById('recordBtn').style.display = 'none';
  window.close();
});

function updateTimerDisplay() {
  if (!recordingStartTime) return;
  const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
  const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const secs = String(elapsed % 60).padStart(2, '0');
  document.getElementById('recordingTimer').textContent = `${mins}:${secs}`;
}
