# syntax=docker/dockerfile:1
# Mister web (SPA statica) — build su GitHub Actions, run su Coolify (immagine ghcr.io/twentivan/mister-web)

# ---------- stage 1: build ----------
FROM node:24-alpine AS build
RUN npm install -g pnpm@10
WORKDIR /repo

# vite.config.ts esige PORT e BASE_PATH anche solo per buildare (PORT non viene usata nel bundle)
ENV PORT=5173
ENV BASE_PATH=/
# VITE_API_URL volutamente NON impostata: in produzione la base URL dell'API si deriva dal dominio (app.X -> api.X)

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.base.json tsconfig.json ./
COPY artifacts/mister-web/package.json artifacts/mister-web/
COPY lib ./lib
COPY scripts ./scripts
# NB: niente NODE_ENV=production qui — le dipendenze di build del web sono devDependencies
RUN pnpm install --frozen-lockfile --filter @workspace/mister-web...

COPY artifacts/mister-web ./artifacts/mister-web
COPY attached_assets ./attached_assets
RUN pnpm --filter @workspace/mister-web run build

# ---------- stage 2: runtime ----------
FROM nginx:alpine AS runtime
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/artifacts/mister-web/dist/public /usr/share/nginx/html
EXPOSE 80
