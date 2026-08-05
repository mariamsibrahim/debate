# Multi-stage build for the NestJS API, aware of the npm-workspaces monorepo
# it lives in. Build context is the REPO ROOT (see render.yaml's
# `dockerContext: .`), not apps/api, so all COPY paths below are repo-root
# relative.

FROM node:20-bookworm-slim AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
# Full shared source (not just package.json) has to be here BEFORE `npm ci`:
# the root package.json's `postinstall` runs `npm run build --workspace
# packages/shared` (tsc) automatically as part of `npm ci`, and that fails
# with nothing but tsc's own --help text if the source isn't there yet.
COPY packages/shared packages/shared
RUN npm ci

FROM deps AS build
COPY apps/api apps/api
RUN npx prisma generate --schema apps/api/prisma/schema.prisma
RUN npm run build --workspace=apps/api

FROM node:20-bookworm-slim AS runner
ENV NODE_ENV=production
WORKDIR /repo
# Not pruned to production-only deps: `prisma migrate deploy` at startup
# needs the `prisma` CLI, which is a devDependency. Fine at this scale;
# worth trimming with a separate prod-deps install once image size matters.
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/shared ./packages/shared
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json

WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
