#!/bin/sh
set -e

# Refresh yt-dlp to the latest stable release on every container start.
# YouTube regularly changes its player/signature protocol; a stale binary
# gets rejected with HTTP 403 during downloads.
if command -v yt-dlp >/dev/null 2>&1; then
  yt-dlp -U >/dev/null 2>&1 || echo "[entrypoint] yt-dlp update skipped (no network or already latest)" >&2
fi

exec "$@"