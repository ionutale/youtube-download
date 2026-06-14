const STATE = { IDLE: 'idle', DOWNLOADING: 'downloading', RECORDING: 'recording' };
let state = STATE.IDLE;
let currentTabId = null;
let detectedData = null;
let mediaRecorder = null;
let recordingSession = null;
let stream = null;

function getServerUrl(cb) {
  chrome.storage.sync.get({ serverUrl: 'http://localhost:5173', apiKey: '' }, cb);
}

async function sendToServer(url, pageUrl, title) {
  getServerUrl(async ({ serverUrl, apiKey }) => {
    try {
      const res = await fetch(`${serverUrl.replace(/\/$/, '')}/api/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify({ url, pageUrl, title })
      });
      if (res.ok) {
        const data = await res.json();
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon48.png',
          title: 'Download Started',
          message: title ? `Capturing: ${title}` : 'Video queued for download'
        });
        setBadge('');
        return data.id;
      } else {
        throw new Error(`Server returned ${res.status}`);
      }
    } catch (e) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'Capture Failed',
        message: e.message
      });
    }
  });
}

async function uploadChunk(session, index, data, isFinal, pageUrl, title) {
  getServerUrl(async ({ serverUrl, apiKey }) => {
    const formData = new FormData();
    formData.append('session', session);
    formData.append('index', String(index));
    formData.append('data', data, `chunk-${index}.webm`);
    if (isFinal) {
      formData.append('final', 'true');
      if (pageUrl) formData.append('pageUrl', pageUrl);
      if (title) formData.append('title', title);
    } else {
      formData.append('final', 'false');
    }

    try {
      const res = await fetch(`${serverUrl.replace(/\/$/, '')}/api/upload`, {
        method: 'POST',
        headers: { 'x-api-key': apiKey },
        body: formData
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      if (isFinal) {
        const data = await res.json();
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon48.png',
          title: 'Recording Saved',
          message: title ? `Recording complete: ${title}` : 'Recording saved successfully'
        });
        setBadge('');
      }
    } catch (e) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'Upload Failed',
        message: e.message
      });
    }
  });
}

function startRecording(tabId, pageUrl, title) {
  chrome.tabCapture.capture({ audio: true, video: true }, (capturedStream) => {
    if (!capturedStream) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'Recording Failed',
        message: 'Could not capture tab. Check permissions.'
      });
      return;
    }

    stream = capturedStream;
    state = STATE.RECORDING;
    recordingSession = crypto.randomUUID();
    let chunkIndex = 0;

    mediaRecorder = new MediaRecorder(capturedStream, {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm'
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        const isFinal = mediaRecorder.state === 'inactive';
        uploadChunk(recordingSession, chunkIndex++, event.data, isFinal, pageUrl, title);
      }
    };

    mediaRecorder.onstop = () => {
      state = STATE.IDLE;
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
      }
      setBadge('');
    };

    mediaRecorder.start(10000);
    setBadge('rec');
  });
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
}

function setBadge(mode) {
  if (mode === 'rec') {
    chrome.action.setBadgeText({ text: '●' });
    chrome.action.setBadgeBackgroundColor({ color: '#ff0000' });
  } else if (mode === 'dl') {
    chrome.action.setBadgeText({ text: '↓' });
    chrome.action.setBadgeBackgroundColor({ color: '#00cc00' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
  currentTabId = tabId;
  detectedData = null;
  setBadge('');
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'videoDetected' && sender.tab) {
    const tabId = sender.tab.id;
    if (tabId === currentTabId || currentTabId === null) {
      currentTabId = tabId;
      detectedData = msg.data;

      if (msg.data.streams && msg.data.streams.length > 0) {
        setBadge('dl');
      } else if (msg.data.hasVideo) {
        setBadge('rec');
      } else {
        setBadge('');
      }
    }
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'sendPageToDownloader',
    title: 'Send this page to downloader',
    contexts: ['page', 'link']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'sendPageToDownloader') {
    const url = info.linkUrl || info.pageUrl;
    sendToServer(url, url, tab?.title || '');
  }
});
