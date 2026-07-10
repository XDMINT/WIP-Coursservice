FROM node:22-alpine AS builder

WORKDIR /app

ARG VITE_PUBLIC_API_BASE_URL=/api
ENV VITE_PUBLIC_API_BASE_URL=$VITE_PUBLIC_API_BASE_URL

COPY apps/frontend/package*.json ./
RUN npm ci

COPY apps/frontend/ ./
RUN npm run build

FROM nginx:1.27-alpine AS production

COPY apps/frontend/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
