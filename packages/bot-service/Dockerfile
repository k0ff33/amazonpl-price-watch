FROM node:22-alpine AS builder
RUN corepack enable pnpm

WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/bot-service/package.json packages/bot-service/
RUN pnpm install --frozen-lockfile --filter @liskobot/bot-service --filter @liskobot/shared

COPY packages/shared/ packages/shared/
COPY packages/bot-service/ packages/bot-service/
RUN pnpm --filter @liskobot/shared build && pnpm --filter @liskobot/bot-service build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/packages/bot-service/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./node_modules/@liskobot/shared/dist
COPY --from=builder /app/packages/shared/package.json ./node_modules/@liskobot/shared/package.json

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/index.js"]
