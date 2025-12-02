ARG NODE_VERSION=22-bookworm-slim

# 1) Builder: install deps and build
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
ENV CI=1
COPY pnpm-lock.yaml package.json ./
RUN corepack enable && corepack prepare pnpm@latest --activate
# Fix for EAGAIN errors in Docker (filesystem locking issues)
RUN pnpm config set package-import-method copy
RUN pnpm install --frozen-lockfile
COPY . .
# Build with adapter-node
ENV SVELTE_ADAPTER=node
RUN pnpm run build

# 2) Runner: minimal image
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV SVELTE_ADAPTER=node
ENV DOWNLOAD_DIR=/data

RUN corepack enable && corepack prepare pnpm@latest --activate

# Install runtime tools: ffmpeg, curl (for healthcheck & downloading yt-dlp), and ca-certificates
RUN apt-get update \
	&& apt-get install -y --no-install-recommends ffmpeg curl ca-certificates python3 \
	&& rm -rf /var/lib/apt/lists/*

# Install latest yt-dlp directly
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Only copy production files
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
CMD ["node", "build"]
