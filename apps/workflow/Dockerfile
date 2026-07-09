FROM --platform=$BUILDPLATFORM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY services/apps/workflow/package*.json ./apps/workflow/

RUN npm install

COPY services/apps/workflow/ ./apps/workflow/
COPY api-contracts/ /api-contracts/

WORKDIR /app/apps/workflow
RUN npm install
RUN npm install -g @nestjs/cli
RUN npm run build

# ---------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./
COPY services/apps/workflow/package*.json ./apps/workflow/

WORKDIR /app/apps/workflow
COPY --from=builder /app/apps/workflow/node_modules ./node_modules
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/workflow/dist ./dist
COPY --from=builder /api-contracts /api-contracts

USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]