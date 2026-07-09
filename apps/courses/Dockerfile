FROM --platform=$BUILDPLATFORM node:20-alpine AS builder

WORKDIR /app

COPY services/package.json services/package-lock.json* ./
COPY services/apps/courses/package*.json ./apps/courses/

RUN npm install

COPY services/apps/courses/ ./apps/courses/
COPY api-contracts/ /api-contracts/

WORKDIR /app/apps/courses
RUN npm run build

# ---------------------------------------------------
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY services/package.json services/package-lock.json* ./
COPY services/apps/courses/package*.json ./apps/courses/

WORKDIR /app/apps/courses
RUN npm install --omit=dev

COPY --from=builder /app/apps/courses/dist ./dist/apps/courses
COPY --from=builder /api-contracts /api-contracts

USER node

EXPOSE 3000

CMD ["node", "dist/apps/courses/main.js"]