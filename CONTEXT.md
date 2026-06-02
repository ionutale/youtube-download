# Domain Glossary

## Download
A unit of work representing fetching a video or audio stream from YouTube (or other supported platform via yt-dlp). Each download has an ID, source URL, format, quality, and lifecycle status.

## Download Statuses
- **queued** — awaiting execution in the queue
- **downloading** — actively being fetched by yt-dlp
- **completed** — finished successfully, file available
- **failed** — terminated with an error
- **canceled** — manually aborted by the user
- **paused** — manually halted by the user; requires explicit resume
- **suspended** — system-halted by the scheduler outside its allowed window; auto-resumes when the window opens

## Pause vs Suspend
- **Pause**: user-initiated. Kills the yt-dlp process, marks status `paused`. Only the user can resume.
- **Suspend**: scheduler-initiated. Kills the yt-dlp process, marks status `queued`. Auto-resumed when the download window reopens.

## Queue
An ordered sequence of queued downloads waiting to be processed. Each download has a `priority` (higher = first) and `createdAt` (tiebreaker: older first).

## Format
The output container/codec type: `mp4`, `webm`, `mkv`, `mp3`, or `video-only`.

## Quality
Target resolution for video (e.g., `1080`, `720`, `480`) or bitrate for audio (e.g., `128`, `192`, `320`). `highest` means no constraint.

## Playlist
A YouTube playlist URL containing multiple videos. The system expands playlists into individual enqueue operations.

## Batch
A user-supplied list of newline-separated URLs submitted in a single request, each enqueued as an independent download.

## Schedule
A time window (`scheduleStart`/`scheduleEnd`) during which downloads are permitted to run. Outside this window, running downloads are suspended.

## Cleanup
An automatic process that deletes completed downloads older than `retentionDays` and their associated metadata/thumbnails.

## Preferences
Client-side user preferences persisted in `localStorage`. Includes theme, language, default filename pattern, cookie content, proxy URL, and download defaults (SponsorBlock, subtitles, lyrics, codec). Sent per-request to the API.

## Settings
Server-side operational configuration persisted in `download/settings.json`. Includes retention days, webhook URL, schedule window, max concurrency, API key, RSS feeds, and cloud sync provider. Managed via the Settings UI.

## Retention Days
Configurable age threshold (in days). Completed downloads older than this are cleaned up. `0` disables cleanup.

## Library
The browsable collection of completed downloads with their file metadata, served via the `/library` page and `/api/files` endpoint.

## History
The searchable record of all downloads (any status), accessible via the `/history` page and `/api/history` endpoint.

## RSS Feed
An external RSS/Atom feed URL monitored by the system. New YouTube links found in feed items are auto-enqueued.

## Cloud Sync
An optional post-download step that uploads the completed file to an external provider (Google Drive, Dropbox, or S3). Currently stubbed.

## Webhook
An HTTP POST callback sent on download completion or failure, carrying the download's id, title, url, status, and error.

## API Key
A server-generated hex token used to authenticate external API requests. Set via the settings UI; when unset, the API is open.

## Session
A user authentication session created on login. Stored as a token on the user document. Currently partially implemented (`verifySession` returns `null`).

## User Account
A registered user identified by username and SHA-256-hashed password. Required only when authentication is explicitly enabled.
