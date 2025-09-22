# YouTube Downloader (SvelteKit)

A simple YouTube downloader with progress streaming, history, and file serving.

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```bash
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Developing

Install deps and run dev server:

```bash
pnpm install
pnpm run dev
```

### Persistence (SQLite + Fallback)

- This app persists downloads to SQLite at `download/ytdl.db` via `better-sqlite3`.
- If native bindings are unavailable at runtime (common on fresh Node upgrades), the app logs a warning and falls back to JSON files in `download/` so development remains unblocked.

Fix native bindings on macOS/Node 24 (darwin/arm64):

```bash
# Ensure Xcode Command Line Tools are installed
xcode-select --install || true

# Rebuild native bindings for the current Node version
pnpm rebuild better-sqlite3

# Verify it loads
node -e "require('better-sqlite3'); console.log('better-sqlite3 loaded')"
```

Tip: If you switched Node versions (e.g., via `nvm`), reinstall deps:

```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
pnpm rebuild better-sqlite3
```

### Docker

Build and run locally:

```bash
docker compose up --build
# then open http://localhost:3000
```

Manual build/run without compose:

```bash
docker build -t youtube-download .
docker run --rm -p 3000:3000 -e DOWNLOAD_DIR=/data -v "$PWD/download":/data youtube-download
```

Notes:
- Image uses Node 22 Alpine and the Node adapter. The app listens on `0.0.0.0:3000`.
- The `download/` directory is mounted to `/data` for persistence, and SQLite DB is stored there.

## Environment

Copy `.env.example` to `.env` and adjust as needed:

```
DOWNLOAD_DIR=download
MAX_CONCURRENCY=2
PROGRESS_INTERVAL_MS=200
DEFAULT_QUALITY=highest
DEFAULT_FORMAT=mp4
```

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

## API and Routes

- `POST /api/download?url=<u>&quality=<q>&format=<mp3|mp4>` — start download
- `GET /api/download?url=<u>&quality=<q>` — fetch video info
- `GET /api/events` — Server-Sent Events for progress updates
- `GET /api/history` — list downloaded items
- `DELETE /api/history?rel=<relative>` — delete an item by relative path
- `GET /files/<relative>` — serve downloaded file with range support

> For deployment, install a SvelteKit adapter, e.g. `@sveltejs/adapter-node`.
