FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build:node

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4321 \
    ARIA_RUNTIME=node \
    ARIA_STORAGE_BACKEND=sqlite \
    ARIA_AUTH_BACKEND=local-libsql

WORKDIR /app

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY --from=build /app/aria/storage ./aria/storage

RUN mkdir -p /app/aria/storage /app/public/uploads \
    && chown -R node:node /app/aria/storage /app/public/uploads

USER node

EXPOSE 4321

CMD ["node", "./dist/server/entry.mjs"]
