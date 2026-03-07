# ──────────────────────────────────────
# Base: Node 22 + pnpm
# ──────────────────────────────────────
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# ──────────────────────────────────────
# Dependencies: install node_modules
# ──────────────────────────────────────
FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/crons/package.json apps/crons/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/types/package.json packages/types/package.json

RUN pnpm install --frozen-lockfile

# ──────────────────────────────────────
# Source: copy all source code
# ──────────────────────────────────────
FROM deps AS source
COPY . .

# ──────────────────────────────────────
# Web: build static files
# ──────────────────────────────────────
FROM source AS web-build
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @tuldio/web build

# ──────────────────────────────────────
# API: Express + Puppeteer
# ──────────────────────────────────────
FROM source AS api

# Puppeteer system dependencies + Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    libgbm1 \
    libnss3 \
    libatk-bridge2.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libcups2 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

EXPOSE 3003
CMD ["sh", "-c", "pnpm --filter @tuldio/api exec tsx ../../packages/core/src/lib/database/migrate.ts && pnpm --filter @tuldio/api exec tsx src/index.ts"]

# ──────────────────────────────────────
# Crons: scheduled jobs
# ──────────────────────────────────────
FROM source AS crons
CMD ["pnpm", "--filter", "@tuldio/crons", "exec", "tsx", "src/index.ts"]

# ──────────────────────────────────────
# Caddy: serves web + reverse proxy
# ──────────────────────────────────────
FROM caddy:2-alpine AS caddy
COPY --from=web-build /app/apps/web/dist /srv/web
COPY Caddyfile /etc/caddy/Caddyfile
