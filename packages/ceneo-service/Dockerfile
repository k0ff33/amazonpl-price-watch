FROM node:22-alpine AS builder
RUN corepack enable pnpm

WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/ceneo-service/package.json packages/ceneo-service/
RUN pnpm install --frozen-lockfile --filter @liskobot/ceneo-service --filter @liskobot/shared

COPY packages/shared/ packages/shared/
COPY packages/ceneo-service/ packages/ceneo-service/
RUN pnpm --filter @liskobot/shared build && pnpm --filter @liskobot/ceneo-service build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder --chown=node:node /app/packages/ceneo-service/dist ./dist
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/packages/shared/dist ./node_modules/@liskobot/shared/dist
COPY --from=builder --chown=node:node /app/packages/shared/package.json ./node_modules/@liskobot/shared/package.json

EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:3002/health || exit 1
USER node
CMD ["node", "dist/index.js"]
