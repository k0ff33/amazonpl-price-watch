FROM node:24-alpine AS builder
RUN corepack enable pnpm

WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/bot-service/package.json packages/bot-service/
RUN pnpm install --frozen-lockfile --filter @liskobot/bot-service --filter @liskobot/shared

COPY packages/shared/ packages/shared/
COPY packages/bot-service/ packages/bot-service/
RUN pnpm --filter @liskobot/shared build && pnpm --filter @liskobot/bot-service build

FROM node:24-alpine
WORKDIR /app
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/packages/shared ./packages/shared
COPY --from=builder --chown=node:node /app/packages/bot-service ./packages/bot-service

WORKDIR /app/packages/bot-service
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:3000/health || exit 1
USER node
CMD ["node", "dist/index.js"]
