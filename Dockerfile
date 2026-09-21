# =====================================================================
# ENLACE ERP - DOCKERFILE OFICIAL MULTI-STAGE DE PRODUÇÃO
# =====================================================================

# Estágio 1: Build da Aplicação
FROM node:22-alpine AS builder

WORKDIR /app

# Instalação das dependências
COPY package*.json ./
RUN npm ci

# Cópia do código-fonte e build de produção (Vite + esbuild CJS server)
COPY . .
RUN npm run build

# Estágio 2: Imagem Minimalista de Produção (Runtime)
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copia dependências de produção apenas
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copia os artefatos compilados do estágio de build
COPY --from=builder /app/dist ./dist

# Usuário sem privilégios de root para segurança
USER node

# Exposição estrita da porta 3000 (requisito de infraestrutura Cloud Run / Nginx)
EXPOSE 3000

# Inicialização do servidor unificado CommonJS
CMD ["node", "dist/server.cjs"]
