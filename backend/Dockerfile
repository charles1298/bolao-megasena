FROM node:20-alpine AS base
WORKDIR /app

# Instala OpenSSL e dependências nativas necessárias para o Prisma
RUN apk add --no-cache openssl libc6-compat

# Instala todas as dependências
FROM base AS deps
COPY package*.json ./
RUN npm ci

# Gera o Prisma Client
FROM deps AS builder
COPY . .
RUN npx prisma generate

# Imagem final
FROM base AS runner
ENV NODE_ENV=production

# Cria usuário não-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copia tudo do builder (inclui node_modules com prisma CLI e engine)
COPY --from=builder /app /app

# Garante permissões corretas
RUN mkdir -p /app/logs && chown -R appuser:appgroup /app

USER appuser

EXPOSE 3001

HEALTHCHECK NONE

CMD ["node", "server.js"]
