ARG NODE_BASE_IMAGE=node:22-alpine

FROM ${NODE_BASE_IMAGE} AS build
WORKDIR /app

# Build-time registry override for environments that cannot reach registry.npmjs.org.
# docker-compose passes NPM_REGISTRY; enterprise deployments may point this to an internal mirror.
ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV COREPACK_NPM_REGISTRY=${NPM_REGISTRY} \
    npm_config_registry=${NPM_REGISTRY}

RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --no-frozen-lockfile
COPY . .
RUN pnpm run build:all && pnpm prune --prod

FROM ${NODE_BASE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/migrations ./server/migrations

EXPOSE 8787
CMD ["sh", "-c", "node server/dist/migrate.js && node server/dist/seed.js && node server/dist/index.js"]
