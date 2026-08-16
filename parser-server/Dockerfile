# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# Stage 2: Production
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Image cache lives on a volume so restarts keep warm pages
RUN mkdir -p /app/cache && chown -R node:node /app/cache

USER node

ENV NODE_ENV=production
ENV PORT=7845
ENV HOST=0.0.0.0
ENV CACHE_DIR=/app/cache

EXPOSE 7845

CMD ["node", "dist/index.js"]
