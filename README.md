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
