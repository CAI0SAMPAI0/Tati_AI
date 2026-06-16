# ─── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copia arquivos de configuração do workspace
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY packages/hub-core/package*.json ./packages/hub-core/

# Instala dependências
RUN npm ci --prefer-offline

# Copia o código necessário
COPY packages/hub-core ./packages/hub-core
COPY frontend ./frontend
# Logo da Prof. Tatiana (fonte canônica: backend/assets)
COPY backend/assets/images/tati_logo.jpg ./frontend/public/images/tati_logo.jpg

# Variáveis de build
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

# Build
WORKDIR /app/frontend
RUN npm run build

# ─── Stage 2: Runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/frontend/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/frontend/package.json ./package.json

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["npm", "start"]
