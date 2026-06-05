# ─── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copia arquivos de configuração do workspace
COPY package*.json ./
COPY apps/hub-site/package*.json ./apps/hub-site/
COPY packages/hub-core/package*.json ./packages/hub-core/

# Instala dependências
RUN npm ci --prefer-offline

# Copia o código necessário
COPY packages/hub-core ./packages/hub-core
COPY apps/hub-site ./apps/hub-site

# Variáveis de build
ARG NEXT_PUBLIC_API_BASE_URL=https://tatiai-production.up.railway.app
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

# Build
WORKDIR /app/apps/hub-site
RUN npm run build

# ─── Stage 2: Runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/hub-site/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/hub-site/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/hub-site/package.json ./package.json

USER nextjs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3001/ || exit 1

CMD ["npm", "start"]
