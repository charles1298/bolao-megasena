# Bolão Mega Sena

Sistema web completo de bolão baseado nos resultados reais da Mega Sena. Cartelas acumulativas, pagamento via PIX (Mercado Pago), painel admin com 2FA.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | Node.js 20 + Express |
| ORM | Prisma + PostgreSQL 16 |
| Frontend | React 18 + Vite |
| Pagamentos | Mercado Pago PIX Dinâmico |
| Auth | JWT + Refresh Token + bcrypt (custo 12) |
| 2FA Admin | TOTP via otplib (Google Authenticator) |
| Deploy | Docker Compose |
| Web Server | Nginx (frontend) |

---

## Pré-requisitos

- Docker 24+ e Docker Compose v2
- Conta no [Mercado Pago Developers](https://www.mercadopago.com.br/developers) com aplicação criada
- Domínio com HTTPS (para webhook do MP funcionar em produção)

---

## Setup rápido

### 1. Clone e configure variáveis de ambiente

```bash
git clone <repo>
cd bolao-megasena
cp .env.example .env
```

Edite `.env` com seus valores reais:

```bash
# Gere secrets seguros:
openssl rand -hex 64   # JWT_SECRET
openssl rand -hex 64   # JWT_REFRESH_SECRET
openssl rand -hex 32   # POSTGRES_PASSWORD
```

### 2. Suba os containers

```bash
docker compose up -d --build
```

O serviço `migrate` executará automaticamente as migrations do Prisma e criará o usuário admin padrão.

### 3. Primeiro login admin

- Acesse `/login` e entre com `admin` / senha definida em `ADMIN_INITIAL_PASSWORD`
- Vá em `/admin` → aba **2FA** → escaneie o QR Code com o Google Authenticator
- A partir do próximo login, o código 2FA será obrigatório

### 4. Criar o primeiro jogo

No painel admin → aba **Jogo** → preencha nome e data de início → clique em **Criar jogo**.

---

## Configuração do Mercado Pago

### Obter credenciais

1. Acesse [mercadopago.com.br/developers](https://www.mercadopago.com.br/developers)
2. Crie uma aplicação
3. Copie o **Access Token de produção** para `MP_ACCESS_TOKEN` no `.env`

### Configurar Webhook

1. No painel MP → sua aplicação → **Webhooks**
2. URL: `https://seudominio.com.br/api/payments/webhook`
3. Eventos: marque **payment**
4. Copie o **secret** gerado para `MP_WEBHOOK_SECRET` no `.env`

> **Importante:** O webhook precisa de HTTPS real. Em desenvolvimento, use [ngrok](https://ngrok.com) para expor o localhost.

---

## Fluxo do jogo

```
1. Admin cria jogo com data de início
2. Usuários se cadastram e compram cartelas (R$ 30 cada)
3. Pagamento PIX é confirmado → cartela fica "ativa"
4. A cada sorteio real da Mega Sena (ter/qui/sáb):
   - Admin registra os 6 números no painel
   - Sistema acumula acertos por cartela
   - Cartelas com 5 acertos = "Pé Quente"
   - Cartelas com 0 acertos no sorteio = "Pé Frio"
5. Quando alguma cartela atingir 6 acertos acumulados:
   - Jogo é marcado como "finished"
   - Admin processa a distribuição de prêmios
6. Usuários veem seus prêmios no painel
```

### Distribuição de prêmios

| Categoria | % do arrecadado |
|-----------|-----------------|
| 6 acertos (ganhador) | 65% (dividido igualmente) |
| Pé Quente (5 acertos acumulados) | 10% (dividido) |
| Pé Frio (0 acertos no último draw) | 5% (dividido) |
| Casa (operação) | 20% |

---

## Endpoints da API

### Autenticação

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/register` | Cadastro (nickname + senha + whatsapp?) |
| POST | `/api/auth/login` | Login (suporta 2FA para admin) |
| POST | `/api/auth/refresh` | Renovar access token |
| POST | `/api/auth/logout` | Logout (revoga refresh token) |

### Jogo

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/api/game/current` | — | Info pública do jogo ativo |
| POST | `/api/game/tickets` | JWT | Comprar cartelas + gerar PIX |
| GET | `/api/game/tickets/my` | JWT | Minhas cartelas |
| GET | `/api/game/tickets/:id` | JWT | Detalhe de uma cartela |

### Pagamentos

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/api/payments/webhook` | MP Signature | Webhook do Mercado Pago |
| POST | `/api/payments/check/:id` | JWT | Checar status (polling manual) |

### Usuário

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/api/users/me` | JWT | Perfil |
| PATCH | `/api/users/me` | JWT | Atualizar WhatsApp |
| GET | `/api/users/me/stats` | JWT | Estatísticas pessoais |

### Admin (requer role=admin)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/admin/dashboard` | Resumo geral |
| GET | `/api/admin/totp/setup` | Gerar QR Code 2FA |
| POST | `/api/admin/totp/confirm` | Ativar 2FA |
| POST | `/api/admin/games` | Criar jogo |
| PATCH | `/api/admin/games/:id/activate` | Ativar jogo pendente |
| POST | `/api/admin/games/:id/draws` | Registrar sorteio Mega Sena |
| POST | `/api/admin/games/:id/prizes` | Distribuir prêmios |
| GET | `/api/admin/users` | Listar apostadores |
| GET | `/api/admin/transactions` | Listar transações |
| GET | `/api/admin/reports/tickets.csv` | Exportar cartelas CSV |
| GET | `/api/admin/reports/transactions.csv` | Exportar transações CSV |
| GET | `/api/admin/logs` | Log de ações admin |

---

## Segurança implementada

- **HTTPS forçado** via header `X-Forwarded-Proto` em produção
- **Helmet.js** com CSP, HSTS (1 ano), X-Frame-Options, etc.
- **CORS** restrito ao domínio do frontend
- **Rate limiting**: 200 req/15min geral · 5 tentativas/15min no login · 10 cadastros/hora
- **bcrypt** custo 12 para senhas
- **JWT** com expiração de 7 dias + refresh token rotacionado
- **Refresh token** armazenado no banco (permite revogação)
- **2FA TOTP** para administradores
- **Sanitização XSS** em todos os campos via `xss` + `express-validator`
- **SQL injection impossível** via Prisma parametrizado
- **Input validation** server-side obrigatório em todos os endpoints
- **Webhook MP** validado por HMAC-SHA256
- **Logs estruturados** sem expor stack trace para o cliente
- **Usuário não-root** nos containers Docker
- **Variáveis sensíveis** exclusivamente em `.env` (nunca no código)
- **Timing-safe comparison** nas validações críticas

---

## Desenvolvimento local (sem Docker)

```bash
# Terminal 1 — Backend
cd backend
cp .env.example .env  # Edite com seu PostgreSQL local
npm install
npx prisma migrate dev --name init
node prisma/seed.js
npm run dev

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
```

---

## Produção com SSL (recomendado)

Use um reverse proxy externo (ex: Caddy ou Nginx na host machine) apontando para a porta 80 do container frontend. O Caddy provê SSL automático:

```
# Caddyfile
seudominio.com.br {
    reverse_proxy localhost:80
}
```

---

## Variáveis de ambiente — referência completa

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `POSTGRES_PASSWORD` | ✅ | Senha do PostgreSQL |
| `JWT_SECRET` | ✅ | Secret JWT (mín. 32 bytes) |
| `JWT_REFRESH_SECRET` | ✅ | Secret refresh token |
| `FRONTEND_URL` | ✅ | URL do frontend (CORS) |
| `BACKEND_URL` | ✅ | URL da API (webhook MP) |
| `MP_ACCESS_TOKEN` | ✅ | Token de produção do Mercado Pago |
| `MP_WEBHOOK_SECRET` | ✅ | Secret do webhook MP |
| `ADMIN_WHATSAPP` | ✅ | Número para fallback de comprovante |
| `ADMIN_INITIAL_PASSWORD` | ✅ (seed) | Senha inicial do admin |
| `TICKET_PRICE_BRL` | — | Preço da cartela (padrão: 30.00) |
| `BCRYPT_ROUNDS` | — | Custo bcrypt (padrão: 12) |
| `LOG_LEVEL` | — | Nível de log (padrão: info) |

---

## Licença

Uso privado — não redistribuir.
