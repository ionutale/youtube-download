# Browser Capture Extension + Prime Video Support

Date: 2026-06-14

## Problem

The app currently downloads from YouTube (and yt-dlp supported sites) but has no way to:
1. Download from Prime Video and other DRM-protected streaming sites
2. Capture video streams from any webpage via a browser extension
3. Record pixel-level video as a fallback when stream extraction fails
4. Support Brave (Chromium-based) extension, not just Chrome

## Solution Overview

Two systems work together:

**A. Brave/Chrome extension** that auto-detects video content on any page, finds streams, and either:
   - Sends stream URLs to the server for yt-dlp download (non-DRM)
   - Falls back to tab recording (pixel capture) for DRM content

**B. Server additions** to handle the new extension-sourced download types:
   - `POST /api/capture` — accepts stream URLs for yt-dlp
   - `POST /api/upload` — accepts chunked recording uploads

## Extension Architecture

### Detection Pipeline (tried in order)

1. **Page URL** — always sent to server alongside any stream URL. Server runs yt-dlp which handles site extraction.
2. **Network stream sniffing** — content script monitors `webRequest` for HLS (`.m3u8`) and DASH (`.mpd`) manifest URLs.
3. **Tab recording** — `chrome.tabCapture` + `MediaRecorder` for DRM content where streams can't be extracted.

### Extension Components

| File | Purpose |
|---|---|
| `content.js` | Injected script: scans `<video>` elements, monitors network requests, extracts page metadata |
| `background.js` | Service worker: message routing, stream detection handler, recording state machine, notifications |
| `popup.html` + `popup.js` | UI: show detected streams, [Download] button, [Record] button with timer, status |
| `manifest.json` | Permissions, content scripts, host permissions |

### Content Script (`content.js`)

Responsibilities:
- `<video>` element detection: count, dimensions, data attributes
- Network request monitoring via `performance.getEntriesByType('resource')` polling for `.m3u8`/`.mpd` URLs
- Page metadata extraction (title, site name)
- POSTs findings to `background.js` via `chrome.runtime.sendMessage`

### Background Service Worker (`background.js`)

State machine:

```
IDLE
  → receives video detected message
  → sets badge to "↓" if stream found, "●" if record available
  → waits for user action

DOWNLOADING
  → user clicked Download
  → POSTs to /api/capture
  → opens status notification
  → on completion: notification + badge clears

RECORDING
  → user clicked Record
  → chrome.tabCapture.capture({ audio: true, video: true })
  → new MediaRecorder(timeslice: 10000)
  → ondataavailable → POST chunk to /api/upload
  → user clicks Stop → MediaRecorder.stop() → finalize
  → on error: notification
```

### Popup UI (`popup.html` + `popup.js`)

Three states:
1. **No video detected**: "No video found on this page"
2. **Stream found**: Show detected stream info + [Download] button
3. **Recording available**: [Record] button + duration timer while recording

### Manifest Changes (`manifest.json`)

```
permissions:
  - activeTab        (tab capture, current tab query)
  - tabCapture       (record tab)
  - webRequest       (monitor network streams)
  - contextMenus     (right-click menu)
  - storage          (settings persistence)
  - notifications    (completion/failure)

host_permissions:
  - *://*/*          (needed for webRequest + content scripts)

content_scripts:
  - matches: <all_urls>
    js: content.js
    run_at: document_idle
```

## Server Architecture

### New Endpoints

#### `POST /api/capture`

Accepts stream URL downloads from the extension.

Request:
```json
{
  "url": "https://example.com/video.m3u8",
  "pageUrl": "https://prime.com/movie/123",
  "title": "Movie Title",
  "format": "mp4",
  "quality": "highest"
}
```

Response: `{ id: "download-uuid" }`

Implementation: delegates to existing `DownloadEngine` with a flag to skip yt-dlp info extraction when a direct stream URL is provided. The engine runs yt-dlp with the stream URL directly.

#### `POST /api/upload`

Accepts chunked recording uploads. Uses multipart form data.

Chunk request:
```
POST /api/upload
Content-Type: multipart/form-data

session: "uuid"
index: 0
final: "false"
file: <binary blob>
```

Final request:
```
POST /api/upload
Content-Type: multipart/form-data

session: "uuid"
final: "true"
pageUrl: "https://prime.com/movie/123"
title: "Movie Title"
```

Response: `{ id: "download-uuid" }` (only on final request)

### Upload Engine (`src/lib/server/upload.ts`)

```
UploadEngine:
  - tempDir: download/temp-recording/
  - activeSessions: Map<sessionId, { path, chunkCount, pageUrl, title }>
  
  handleChunk(session, index, data, final):
    - Write chunk to tempDir/<session>/chunk-<index>
    - Update activeSessions
    - If final:
      - Concatenate chunks
      - Run ffmpeg -i input.webm -c copy -movflags faststart output.mp4 (re-mux optimized for streaming)
      - Move to download dir
      - Create DownloadRecord
      - Emit SSE event
      - Clean up temp files
  
  cleanup(session):
    - Remove temp files on error/timeout
```

Retention: temp files older than 24h are cleaned up by the existing cleanup timer.

### Download Engine Changes (`engine.ts`)

Minor addition:
- `enqueueStream(url: string, options)` — same as existing enqueue but marks source and skips yt-dlp metadata fetch (since we already have a direct stream URL)

### Types (`types.ts`)

Add to `DownloadRecord`:
```ts
source: 'manual' | 'youtube' | 'extension-capture' | 'extension-recording'
```

## Data Flow Diagrams

### Download (stream found)

```
Extension content.js
  ↓ detects video + stream URLs
  ↓ sends to background.js
Background.js
  ↓ POST /api/capture { url, pageUrl, title }
Server
  ↓ DownloadEngine.enqueueStream(url)
  ↓ yt-dlp download
  ↓ SSE updates to web UI + extension
Extension
  ↓ notification "Download complete"
```

### Recording (no stream, DRM content)

```
Extension content.js
  ↓ detects video, NO streams
Background.js
  ↓ shows record button in popup
User clicks Record
  ↓ chrome.tabCapture.capture()
  ↓ MediaRecorder begins
  ↓ ondataavailable → POST /api/upload { chunk }
  ↓ ... repeats ...
User clicks Stop
  ↓ POST /api/upload { final: true }
Server
  ↓ UploadEngine assembles chunks
  ↓ ffmpeg re-mux
  ↓ Save + CreateRecord
  ↓ SSE event
Extension
  ↓ notification "Recording saved"
```

## Error Handling

| Scenario | What happens |
|---|---|
| No video on page | Popup shows "No video detected" |
| yt-dlp fails on stream URL | Download fails, error notification, retry available |
| tabCapture permission denied | Error message in popup, suggest granting permission |
| Recording interrupted (navigation) | Finalize partial recording, notify user |
| Upload fails mid-recording | Retry chunk, notify if persistent failure |
| Temp file cleanup | Existing 1h cleanup timer handles stale recordings |
| Recording too long | Configurable max duration (default: 6 hours) |

## Configuration

New env vars:
- `RECORDING_TEMP_DIR` — temp directory for recording chunks (default: `download/temp-recording`)
- `RECORDING_MAX_DURATION_MS` — max recording duration (default: 6 hours)
- `RECORDING_MAX_FILE_SIZE` — max final file size (default: 50GB)

## Future Considerations

- Firefox extension (uses `browser` API instead of `chrome`)
- Safari extension (requires Xcode + macOS app wrapper + Apple Developer Program)
- Notification system improvements (browser push when download completes while extension is closed)
- Recording quality settings (VP9 vs H264, bitrate selection)
- Concurrent downloads from extension (queue management already handles this)
