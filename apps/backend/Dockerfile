FROM node:22-alpine AS dependencies

WORKDIR /app

COPY apps/backend/package*.json ./
RUN npm ci

FROM dependencies AS builder

COPY apps/backend/ ./
RUN npm run build

FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY apps/backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/storage/materials && chown -R node:node /app/storage

USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]
