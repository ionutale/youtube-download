ARG NODE_VERSION=22-alpine

# 1) Builder: install deps and build
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
ENV CI=1
COPY pnpm-lock.yaml package.json ./
RUN corepack enable && corepack prepare pnpm@latest --activate
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

# Only copy production files
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules

# Ensure native modules are built for this image
RUN pnpm rebuild better-sqlite3 && node -e "require('better-sqlite3');console.log('better-sqlite3 ok')"

EXPOSE 3000
VOLUME ["/data"]
CMD ["node", "build"]
