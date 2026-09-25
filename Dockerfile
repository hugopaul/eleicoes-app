FROM node:22-bookworm-slim AS build

WORKDIR /app/api
COPY api/package.json api/package-lock.json ./
RUN npm ci
COPY api/tsconfig.json api/tsconfig.build.json ./
COPY api/src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PORT=3000 \
    FOTOS_DIR=/data/fotos

WORKDIR /app
COPY --from=build /app/api/node_modules /app/api/node_modules
COPY --from=build /app/api/dist /app/api/dist
COPY frontend /app/frontend
COPY samples /app/samples

WORKDIR /app/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
