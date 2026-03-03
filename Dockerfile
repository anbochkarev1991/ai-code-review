# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder
WORKDIR /app

# Shared package
COPY shared/package*.json ./shared/
COPY shared/tsconfig.json ./shared/
COPY shared/src ./shared/src
RUN cd shared && npm ci && npm run build

# Backend deps + build
COPY backend/package*.json ./backend/
COPY backend/tsconfig*.json ./backend/
COPY backend/nest-cli.json ./backend/
RUN cd backend && npm ci

COPY backend/src ./backend/src
COPY backend/scripts ./backend/scripts
RUN cd backend && npm run build

FROM node:22-alpine AS runner
WORKDIR /app

# shared runtime artifacts (backend depends on file:../shared)
COPY shared/package*.json ./shared/
COPY --from=builder /app/shared/dist ./shared/dist

# backend runtime deps
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

# compiled backend
COPY --from=builder /app/backend/dist ./backend/dist

WORKDIR /app/backend
EXPOSE 8000
CMD ["node", "dist/src/main.js"]