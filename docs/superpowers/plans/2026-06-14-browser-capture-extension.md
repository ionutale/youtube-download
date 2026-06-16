# Browser Capture Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development or executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Brave/Chrome extension that auto-detects video streams on any page and sends them to the server for download, with a tab-recording fallback for DRM content.

**Architecture:** Extension uses a 3-layer detection pipeline (page URL → network stream sniffing → tab recording). Server gets two new endpoints (`/api/capture` for stream URLs, `/api/upload` for recording chunks) plus an upload engine for chunk assembly.

**Tech Stack:** Chrome Extension Manifest V3, SvelteKit + TypeScript (server), yt-dlp (download engine), ffmpeg (recording re-mux), tabCapture API (recording)

---

### Task 1: Extension - manifest.json updates

**Files:**
- Modify: `extension/manifest.json`
- Create: `extension/icons/icon-record.png`, `extension/icons/icon-download.png`

- [ ] **Step 1: Update manifest.json with new permissions and content scripts**

```json
{
  "manifest_version": 3,
  "name": "Video Downloader Capture",
  "version": "1.1",
  "description": "Auto-detect video streams and send them to your downloader server. Falls back to tab recording for DRM content.",
  "permissions": [
    "activeTab",
    "tabCapture",
    "webRequest",
    "contextMenus",
    "storage",
    "notifications"
  ],
  "host_permissions": [
    "*://*/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["*://*/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icon16.png",
      "48": "icon48.png",
      "128": "icon128.png"
    }
  },
  "icons": {
    "16": "icon16.png",
    "48": "icon48.png",
    "128": "icon128.png"
  },
  "options_ui": {
    "page": "options.html",
    "open_in_tab": false
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add extension/manifest.json
git commit -m "feat(extension): update manifest v3 with video capture permissions"
```

---

### Task 2: Extension - content.js (video detection + network sniffing)

**Files:**
- Create: `extension/content.js`

Content script responsibilities:
1. Detect `<video>` elements on the page
2. Monitor `performance.getEntriesByType('resource')` for HLS/DASH manifests
3. Monitor network requests via `PerformanceObserver` for new media resources
4. Extract page metadata (title, site name)
5. Send findings to background.js via `chrome.runtime.sendMessage`

- [ ] **Step 1: Write content.js**

```javascript
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
    // performance API may not be available
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

// Initial scan
scanForVideoElements();
scanForStreams();
sendStatus();

// Observe new resources being loaded
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

// Re-scan for video elements on DOM changes
const domObserver = new MutationObserver(() => {
  scanForVideoElements();
  sendStatus();
});
domObserver.observe(document.body, { childList: true, subtree: true });

// Listen for background asking for a status update
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'getStatus') {
    scanForVideoElements();
    scanForStreams();
    sendStatus();
    sendResponse({ ok: true });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add extension/content.js
git commit -m "feat(extension): add content script for video detection and stream sniffing"
```

---

### Task 3: Extension - background.js rewrite

**Files:**
- Modify: `extension/background.js`

Background service worker handles:
1. Message routing from content script
2. Stream state management (current tab)
3. Tab recording with `chrome.tabCapture` + `MediaRecorder`
4. Sending capture URLs to server via `POST /api/capture`
5. Uploading recording chunks to server via `POST /api/upload`
6. Notifications on completion/failure
7. Context menu for sending page URL

- [ ] **Step 1: Write background.js**

```javascript
const STATE = { IDLE: 'idle', DOWNLOADING: 'downloading', RECORDING: 'recording' };
let state = STATE.IDLE;
let currentTabId = null;
let detectedData = null;
let mediaRecorder = null;
let recordedChunks = [];
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

    mediaRecorder.start(10000); // 10-second chunks
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

// Track current tab for content script communication
chrome.tabs.onActivated.addListener(({ tabId }) => {
  currentTabId = tabId;
  detectedData = null;
  setBadge('');
});

// Listen for messages from content script
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

// Context menu (for any page, not just YouTube)
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
```

- [ ] **Step 2: Commit**

```bash
git add extension/background.js
git commit -m "feat(extension): rewrite background.js with recording state machine and capture flow"
```

---

### Task 4: Extension - popup.html + popup.js redesign

**Files:**
- Modify: `extension/popup.html`
- Modify: `extension/popup.js`

- [ ] **Step 1: Rewrite popup.html**

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { width: 280px; padding: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1a1a1a; color: #e0e0e0; margin: 0; }
    h2 { font-size: 14px; margin: 0 0 8px 0; color: #fff; }
    .status { padding: 8px; background: #252525; border-radius: 6px; margin-bottom: 10px; font-size: 12px; }
    .status-icon { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
    .icon-idle { background: #666; }
    .icon-dl { background: #00cc00; }
    .icon-rec { background: #ff4444; animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    .stream-list { font-size: 11px; color: #999; word-break: break-all; margin-top: 4px; }
    .stream-item { padding: 2px 0; }
    button { width: 100%; padding: 8px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px; margin-bottom: 6px; }
    button:hover { opacity: 0.9; }
    .btn-dl { background: #00cc66; color: #000; }
    .btn-rec { background: #ff4444; color: #fff; }
    .btn-stop { background: #cc3333; color: #fff; }
    .btn-open { background: #555; color: #e0e0e0; }
    .btn-config { background: #333; color: #888; font-size: 11px; }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .timer { font-size: 16px; font-weight: bold; text-align: center; padding: 8px; color: #ff4444; }
    .config { display: none; }
    .config input { width: 100%; padding: 6px; margin-bottom: 8px; background: #333; border: 1px solid #444; color: #e0e0e0; border-radius: 4px; box-sizing: border-box; font-size: 12px; }
    .config label { display: block; font-size: 11px; color: #888; margin-bottom: 2px; }
    .divider { border-top: 1px solid #333; margin: 8px 0; }
    .page-info { font-size: 11px; color: #aaa; margin-bottom: 4px; }
  </style>
</head>
<body>
  <div id="main">
    <div id="statusArea" class="status">
      <div><span class="status-icon icon-idle" id="statusIcon"></span><span id="statusText">No video detected on this page</span></div>
      <div class="page-info" id="pageInfo"></div>
      <div class="stream-list" id="streamList"></div>
    </div>

    <button class="btn-dl" id="downloadBtn" style="display:none">Download Detected Stream</button>
    <button class="btn-rec" id="recordBtn" style="display:none">Start Recording</button>
    <div id="recordingArea" style="display:none">
      <div class="timer" id="recordingTimer">00:00</div>
      <button class="btn-stop" id="stopBtn">Stop Recording</button>
    </div>

    <div class="divider"></div>
    <button class="btn-open" id="openBtn">Open in Web UI</button>
    <button class="btn-config" id="configBtn">Settings</button>
  </div>

  <div class="config" id="configArea">
    <label for="serverUrl">Server URL</label>
    <input type="text" id="serverUrl" placeholder="http://localhost:5173">
    <label for="apiKey">API Key</label>
    <input type="password" id="apiKey" placeholder="Optional">
    <button class="btn-dl" id="saveBtn">Save</button>
    <button class="btn-config" id="backBtn">Back</button>
  </div>

  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Rewrite popup.js**

```javascript
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
      // If background doesn't respond, try querying the active tab
      queryActiveTab();
    }
  });

  // Background sends us status updates
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
    // Content script not injected yet
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
    streamList.innerHTML = data.streams.map(s => `<div class="stream-item">📺 ${s.split('/').pop()?.slice(0, 50)}</div>`).join('');

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
```

- [ ] **Step 3: Commit**

```bash
git add extension/popup.html extension/popup.js
git commit -m "feat(extension): redesign popup with stream detection and recording UI"
```

---

### Task 5: Server - types + config updates

**Files:**
- Modify: `src/lib/server/download/types.ts`
- Modify: `src/lib/server/config.ts`
- Modify: `.env.example`

- [ ] **Step 1: Add source field to types.ts**

Add to `DownloadRecord` after `priority`:
```ts
source?: 'manual' | 'extension-capture' | 'extension-recording';
```

- [ ] **Step 2: Add recording config to config.ts**

```ts
export const RECORDING_TEMP_DIR = env.RECORDING_TEMP_DIR || path.join(process.cwd(), 'download', 'temp-recording');
export const RECORDING_MAX_DURATION_MS = Number(env.RECORDING_MAX_DURATION_MS || 21_600_000); // 6 hours
```

- [ ] **Step 3: Add env vars to .env.example**

```
# Recording upload
RECORDING_TEMP_DIR=download/temp-recording
RECORDING_MAX_DURATION_MS=21600000
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/download/types.ts src/lib/server/config.ts .env.example
git commit -m "feat(server): add source field and recording config"
```

---

### Task 6: Server - upload engine

**Files:**
- Create: `src/lib/server/upload.ts`

Upload engine handles:
- Receiving chunks from extension recordings
- Writing chunks to temp files
- Assembling chunks on finalization
- Running ffmpeg to re-mux webm to mp4
- Moving final file to download directory
- Creating DownloadRecord via engine.addDownload() (added in Task 9)

- [ ] **Step 1: Write upload.ts**

```ts
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { DOWNLOAD_DIR, RECORDING_TEMP_DIR } from './config';
import { engine } from './download/engine';

interface RecordingSession {
  id: string;
  dir: string;
  chunkCount: number;
  pageUrl?: string;
  title?: string;
  createdAt: number;
}

const activeSessions = new Map<string, RecordingSession>();

function ensureTempDir() {
  if (!fs.existsSync(RECORDING_TEMP_DIR)) {
    fs.mkdirSync(RECORDING_TEMP_DIR, { recursive: true });
  }
}

export function handleUploadChunk(
  session: string,
  index: number,
  data: Buffer | undefined,
  isFinal: boolean,
  pageUrl?: string,
  title?: string
): Promise<{ id: string } | null> {
  ensureTempDir();

  let rec = activeSessions.get(session);
  if (!rec) {
    const dir = path.join(RECORDING_TEMP_DIR, session);
    fs.mkdirSync(dir, { recursive: true });
    rec = { id: session, dir, chunkCount: 0, pageUrl, title, createdAt: Date.now() };
    activeSessions.set(session, rec);
  }

  if (data) {
    const chunkPath = path.join(rec.dir, `${String(index).padStart(6, '0')}.webm`);
    fs.writeFileSync(chunkPath, data);
    rec.chunkCount = Math.max(rec.chunkCount, index + 1);
  }
  if (pageUrl) rec.pageUrl = pageUrl;
  if (title) rec.title = title;

  if (!isFinal) {
    return Promise.resolve(null);
  }

  return finalizeRecording(rec);
}

async function finalizeRecording(rec: RecordingSession): Promise<{ id: string }> {
  const concatPath = path.join(rec.dir, 'concat.txt');
  const chunks: string[] = [];

  for (let i = 0; i < rec.chunkCount; i++) {
    const chunkPath = path.join(rec.dir, `${String(i).padStart(6, '0')}.webm`);
    if (fs.existsSync(chunkPath)) {
      chunks.push(chunkPath);
    }
  }

  if (chunks.length === 0) {
    throw new Error('No chunks received for recording');
  }

  const concatContent = chunks.map(c => `file '${c.replace(/'/g, "'\\''")}'`).join('\n');
  fs.writeFileSync(concatPath, concatContent);

  const safeTitle = (rec.title || 'recording-' + rec.id.slice(0, 8))
    .replace(/[^a-zA-Z0-9-_]+/g, '_')
    .slice(0, 120);
  const outputFilename = `${safeTitle}.webm`;
  const outputPath = path.join(DOWNLOAD_DIR, outputFilename);

  try {
    await new Promise<void>((resolve, reject) => {
      const args = [
        '-f', 'concat',
        '-safe', '0',
        '-i', concatPath,
        '-c', 'copy',
        outputPath
      ];
      const proc = spawn('ffmpeg', args);
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}`));
      });
      proc.on('error', reject);
    });
  } catch (e) {
    if (chunks.length === 1) {
      fs.copyFileSync(chunks[0], outputPath);
    } else {
      throw e;
    }
  }

  const id = crypto.randomUUID();
  const now = Date.now();
  const relPath = path.relative(DOWNLOAD_DIR, outputPath);

  engine.addDownload({
    id,
    url: rec.pageUrl || 'recording:' + rec.id,
    title: rec.title || safeTitle,
    format: 'mp4',
    quality: 'highest',
    progress: 100,
    status: 'completed',
    filename: outputFilename,
    filePath: outputPath,
    relPath,
    source: 'extension-recording',
    createdAt: now,
    updatedAt: now,
    priority: 0
  });

  fs.rmSync(rec.dir, { recursive: true, force: true });
  activeSessions.delete(rec.id);

  return { id };
}

export function cleanupStaleRecordings() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [session, rec] of activeSessions.entries()) {
    if (rec.createdAt < cutoff) {
      fs.rmSync(rec.dir, { recursive: true, force: true });
      activeSessions.delete(session);
    }
  }
  if (fs.existsSync(RECORDING_TEMP_DIR)) {
    for (const entry of fs.readdirSync(RECORDING_TEMP_DIR)) {
      const full = path.join(RECORDING_TEMP_DIR, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory() && stat.mtimeMs < cutoff) {
        fs.rmSync(full, { recursive: true, force: true });
      }
    }
  }
}

export function getActiveRecordingSessions() {
  return Array.from(activeSessions.values()).map(s => ({
    id: s.id,
    chunkCount: s.chunkCount,
    title: s.title,
    createdAt: s.createdAt
  }));
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/server/upload.ts
git commit -m "feat(server): add upload engine for recording chunk assembly"
```

---

### Task 7: Server - /api/capture endpoint

**Files:**
- Create: `src/routes/api/capture/+server.ts`

- [ ] **Step 1: Write capture endpoint**

```ts
import { json } from '@sveltejs/kit';
import { enqueue } from '$lib/server/download/commands';
import { isValidUrl } from '$lib/server/util';
import { DEFAULT_FORMAT, DEFAULT_QUALITY } from '$lib/server/config';

export async function POST({ request }) {
  const body = await request.json().catch(() => ({}));
  const { url, pageUrl, title, format, quality } = body;

  if (!url) return json({ error: 'URL is required' }, { status: 400 });
  if (!isValidUrl(url)) return json({ error: 'Invalid URL' }, { status: 400 });

  try {
    const records = await enqueue(url, {
      format: format || DEFAULT_FORMAT,
      quality: quality || DEFAULT_QUALITY,
      category: 'extension-capture'
    });

    // If a title was provided from the page, use it
    if (title && records[0]) {
      const { engine } = await import('$lib/server/download/engine');
      engine.update(records[0].id, { title, url: pageUrl || url });
    }

    return json({ id: records[0].id, count: records.length });
  } catch (error: any) {
    console.error('[POST /api/capture] error:', error);
    return json({ error: 'Failed to process capture' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
mkdir -p src/routes/api/capture && git add src/routes/api/capture/+server.ts
git commit -m "feat(server): add POST /api/capture endpoint for extension stream captures"
```

---

### Task 8: Server - /api/upload endpoint

**Files:**
- Create: `src/routes/api/upload/+server.ts`

- [ ] **Step 1: Write upload endpoint**

```ts
import { json } from '@sveltejs/kit';
import { handleUploadChunk } from '$lib/server/upload';

export async function POST({ request }) {
  try {
    const formData = await request.formData();
    const session = formData.get('session') as string;
    const indexStr = formData.get('index') as string;
    const isFinal = formData.get('final') === 'true';
    const pageUrl = formData.get('pageUrl') as string | undefined;
    const title = formData.get('title') as string | undefined;

    if (!session) return json({ error: 'session required' }, { status: 400 });

    let data: Buffer | undefined;
    if (!isFinal) {
      const file = formData.get('data');
      if (!file || typeof file === 'string') {
        return json({ error: 'data required for non-final chunk' }, { status: 400 });
      }
      const arrayBuffer = await (file as File).arrayBuffer();
      data = Buffer.from(arrayBuffer);
    }

    const index = parseInt(indexStr || '0');
    const result = await handleUploadChunk(session, index, data, isFinal, pageUrl, title);

    if (result) {
      return json({ id: result.id });
    }
    return json({ ok: true });
  } catch (error: any) {
    console.error('[POST /api/upload] error:', error);
    return json({ error: 'Upload failed: ' + (error?.message || String(error)) }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
mkdir -p src/routes/api/upload && git add src/routes/api/upload/+server.ts
git commit -m "feat(server): add POST /api/upload endpoint for recording chunk uploads"
```

---

### Task 9: Server - add addDownload method + recording cleanup to engine

**Files:**
- Modify: `src/lib/server/download/engine.ts`

Two changes needed by the upload engine:
1. Public `addDownload()` method so upload.ts can insert completed recording records
2. Wire stale recording cleanup into the existing cleanup timer

- [ ] **Step 1: Add addDownload public method to engine.ts**

After `setPriority(id, priority)` (line ~252), add:

```ts
addDownload(record: DownloadRecord): void {
  this.items.set(record.id, record);
  this.emit('event', { type: 'update', download: record } satisfies DownloadEvent);
  this.saveStateDebounced();
}
```

- [ ] **Step 2: Add stale recording cleanup to engine.ts cleanup method**

Find `private async cleanup() {` (line 89). After the closing brace of the existing cleanup logic (the cleanup loop), add:

```ts
try {
  const { cleanupStaleRecordings } = await import('../upload');
  cleanupStaleRecordings();
} catch { }
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/download/engine.ts
git commit -m "feat(server): add addDownload method and stale recording cleanup"
```

---

### Task 10: Extension - background.js: handle popup status requests

**Files:**
- Modify: `extension/background.js`

Add message handlers for popup communication (getPopupStatus, captureStream, startRecording, stopRecording).

- [ ] **Step 1: Add message handlers to background.js**

Append this before the context menu section:

```javascript
// Handle messages from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'getPopupStatus') {
    sendResponse(detectedData);
    return true;
  }

  if (msg.type === 'captureStream' && msg.data) {
    const { url, pageUrl, title } = msg.data;
    state = STATE.DOWNLOADING;
    sendToServer(url, pageUrl, title);
    return true;
  }

  if (msg.type === 'startRecording' && msg.data) {
    const { pageUrl, title, tabId } = msg.data;
    const targetTabId = tabId || currentTabId;
    if (targetTabId) {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        startRecording(tab?.id || targetTabId, pageUrl || tab?.url, title || tab?.title);
      });
    }
    return true;
  }

  if (msg.type === 'stopRecording') {
    stopRecording();
    return true;
  }
});

// Popup opens - push current status
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup') {
    port.postMessage({ type: 'popupStatus', data: detectedData });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add extension/background.js
git commit -m "feat(extension): add popup message handlers for capture, recording, and status"
```

---

### Task 11: Manual verification

- [ ] **Step 1: Load extension in Brave/Chrome**
  1. Open `chrome://extensions`
  2. Enable "Developer mode"
  3. "Load unpacked" → select `extension/` directory
  4. Verify extension icon appears in toolbar

- [ ] **Step 2: Test auto-detection on a YouTube page**
  1. Navigate to a YouTube video
  2. Open extension popup
  3. Verify "Found N video stream(s)" and download button appear

- [ ] **Step 3: Test download via extension**
  1. Click "Download Detected Stream" button
  2. Verify server receives the request
  3. Verify download appears in the web UI

- [ ] **Step 4: Test recording fallback**
  1. Navigate to a page with video but no detectable streams (or a site with DRM)
  2. Verify "Recording available" shows
  3. Click "Start Recording"
  4. Verify timer appears and chunks are being uploaded
  5. Click "Stop Recording"
  6. Verify file appears in the web UI

- [ ] **Step 5: Test context menu**
  1. Right-click any page
  2. Verify "Send this page to downloader" option appears
  3. Click it
  4. Verify server receives the request

- [ ] **Step 6: Verify no regressions in web UI**
  1. Open the web app
  2. Paste a YouTube URL and download
  3. Verify it still works as before
