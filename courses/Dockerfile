FROM node:20-alpine AS builder
WORKDIR /app

COPY services/nodeServers/package.json services/nodeServers/package-lock.json* ./
COPY services/nodeServers/tsconfig*.json ./

COPY services/nodeServers/apps/courses/package.json ./apps/courses/

RUN npm install

COPY services/nodeServers/apps/courses/ ./apps/courses/

RUN npm run build --workspace=courses


FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY services/nodeServers/package.json services/nodeServers/package-lock.json* ./
COPY services/nodeServers/apps/courses/package.json ./apps/courses/

RUN npm install --omit=dev

COPY --from=builder /app/apps/courses/dist ./apps/courses/dist

USER node
EXPOSE 3001

CMD ["node", "apps/courses/dist/main"]
