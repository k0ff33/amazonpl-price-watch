FROM node:24-bookworm AS builder
RUN corepack enable pnpm
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install --with-deps chromium

WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/amazon-scraper/package.json packages/amazon-scraper/
RUN pnpm install --frozen-lockfile --filter @liskobot/amazon-scraper --filter @liskobot/shared

COPY packages/shared/ packages/shared/
COPY packages/amazon-scraper/ packages/amazon-scraper/
RUN pnpm --filter @liskobot/shared build && pnpm --filter @liskobot/amazon-scraper build

FROM node:24-bookworm-slim
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install --with-deps chromium
WORKDIR /app
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/packages/shared ./packages/shared
COPY --from=builder --chown=node:node /app/packages/amazon-scraper ./packages/amazon-scraper
RUN chown -R node:node /ms-playwright

WORKDIR /app/packages/amazon-scraper
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:3001/health || exit 1
USER node
CMD ["node", "dist/index.js"]
