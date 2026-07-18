# 🏗 Arquitetura GoPremiada — Referência pra reusar em novos projetos

Documento técnico do que foi construído neste repositório, com **padrões** e **decisões** que valem ser copiadas em projetos futuros do mesmo perfil (SaaS pequeno-médio em PT-BR, single-operator, com pagamento PIX).

Leia este doc como **boilerplate mental**: cada seção explica o "o que" e o "por quê". Quando começar um novo projeto, vá copiando seção por seção.

---

## 📑 Sumário

1. [Visão geral & filosofia](#-1-visão-geral--filosofia)
2. [Stack & decisões técnicas](#-2-stack--decisões-técnicas)
3. [Estrutura de pastas](#-3-estrutura-de-pastas)
4. [Padrões do backend](#-4-padrões-do-backend)
5. [Padrões do frontend](#-5-padrões-do-frontend)
6. [Banco de dados (Prisma + PostgreSQL)](#-6-banco-de-dados-prisma--postgresql)
7. [Autenticação & segurança](#-7-autenticação--segurança)
8. [Integração de pagamento (PIX via Mercado Pago)](#-8-integração-de-pagamento-pix-via-mercado-pago)
9. [Deploy (Docker + VPS + nginx + Let's Encrypt)](#-9-deploy-docker--vps--nginx--lets-encrypt)
10. [Operacional (backup, health, logs)](#-10-operacional-backup-health-logs)
11. [Workflow de desenvolvimento](#-11-workflow-de-desenvolvimento)
12. [Checklist pra começar projeto novo](#-12-checklist-pra-começar-projeto-novo)
13. [O que NÃO copiar / armadilhas](#-13-o-que-não-copiar--armadilhas)

---

## 🎯 1. Visão geral & filosofia

**Para qual tipo de projeto este molde funciona:**

- SaaS de 1 a ~5k usuários (escala vertical)
- Operação single-founder ou time pequeno (1-3 devs)
- Necessita pagamento online em PT-BR (PIX)
- Quer rodar em VPS própria (~R$ 40-100/mês) ao invés de PaaS caro
- Não quer pagar AWS/GCP nem aprender Kubernetes pra MVP

**Princípios:**

1. **Monolito modular**: tudo num servidor backend, mas organizado em camadas (routes/controllers/services). Microserviço só quando dor real.
2. **Postgres como single source of truth**: nada de "metade no Mongo, metade no Redis".
3. **Redis só pra coisas efêmeras**: rate limit + token blacklist + cache. Nunca pra dado de domínio.
4. **JWT short-lived + refresh**: padrão moderno, sem session table inflada.
5. **Defesa em camadas**: cada validação no front + no back + no banco. Sempre 3 redes.
6. **Deploy é commit + rebuild**: Docker Compose simples, sem orquestrador.
7. **Mostrar erro real ao usuário**: ErrorBoundary + toast claro, nunca tela branca.

---

## ⚙ 2. Stack & decisões técnicas

| Camada | Escolha | Por quê |
|---|---|---|
| **Frontend** | React 18 + Vite | Vite é 10x mais rápido que CRA, build incremental, HMR instantâneo. React por ecossistema. |
| **Roteamento** | React Router v6 | Padrão. Sem Next.js porque não preciso de SSR e queria controle do build. |
| **Estilo** | CSS-in-JS inline + variáveis CSS | Sem Tailwind/styled-components (menos dependência, menos magia). Estilo coeso via variáveis CSS no `index.css`. |
| **Toast** | react-hot-toast | Leve, bonito, API simples. |
| **HTTP** | axios | Interceptor de request (token JWT) + response (auto-refresh em 401). |
| **Backend** | Node.js 20 + Express | Estável, ecossistema enorme, fácil contratar. Sem Nest/Fastify pra evitar overhead conceitual. |
| **ORM** | Prisma 5 | Schema declarativo, migrations versionadas, type-safety, ótimo DX. |
| **Banco** | PostgreSQL 16 | Decimal, JSONB, arrays, índices parciais, constraints. Tudo isso sem MySQL/Mongo. |
| **Cache/Rate Limit** | Redis 7 + rate-limit-redis | Sobrevive a restart, não infla DB com tentativas de login. |
| **Validação** | express-validator + helpers custom | Validação no level da rota antes do controller. |
| **Logging** | winston + morgan | JSON estruturado, rotação automática. |
| **Pagamento** | Mercado Pago API (PIX) | Brasil. Webhook + idempotency-key + polling fallback. |
| **Auth 2FA** | speakeasy + qrcode | TOTP padrão (Google Authenticator). Secret cifrado com AES-256-GCM. |
| **Container** | Docker + docker-compose | 4 services: frontend, backend, db, redis. Build via Dockerfile multi-stage. |
| **Reverse proxy** | nginx (host) + nginx (container) | Host pra SSL+domínio, container do frontend pra servir bundle + proxy de `/api`. |
| **SSL** | Let's Encrypt (certbot) | Grátis, renovação automática. |
| **Lint** | ESLint + `react-hooks/rules-of-hooks` | **Único rule habilitado, rodando no Dockerfile** — bloqueia deploy se quebrar Rules of Hooks. |

---

## 📁 3. Estrutura de pastas

```
projeto/
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js                    # Bootstrap Express + helmet + cors + rotas
│   ├── prisma/
│   │   ├── schema.prisma            # Modelos
│   │   ├── seed.js                  # Cria admin inicial
│   │   └── migrations/              # Versionadas em SQL puro
│   │       └── YYYYMMDDHHMMSS_nome/
│   │           └── migration.sql
│   └── src/
│       ├── controllers/             # Lógica de request/response, valida regras de negócio
│       │   ├── authController.js
│       │   ├── userController.js
│       │   └── adminController.js
│       ├── routes/                  # Definição de endpoints + validação + middlewares
│       │   ├── auth.js
│       │   ├── user.js
│       │   └── admin.js
│       ├── middlewares/
│       │   ├── auth.js              # JWT verify + req.user populado
│       │   ├── admin.js             # require role=admin + auditoria
│       │   ├── rateLimiter.js       # Várias instâncias com pesos diferentes
│       │   ├── validate.js          # Validação + sanitização
│       │   └── errorHandler.js      # Catch global + JSON consistente
│       ├── services/                # Lógica reutilizável (sem req/res)
│       │   ├── prismaClient.js      # Singleton do Prisma
│       │   ├── redisClient.js       # Singleton do Redis com fallback
│       │   ├── mercadoPagoService.js
│       │   └── paymentService.js
│       └── utils/
│           ├── logger.js            # winston configurado
│           ├── cryptoHelper.js      # encrypt/decrypt AES-GCM
│           └── cpfHelper.js         # validador mod 11
│
├── frontend/
│   ├── Dockerfile                   # multi-stage: build (node) → serve (nginx)
│   ├── nginx.conf                   # SPA + proxy de /api
│   ├── package.json
│   ├── vite.config.js
│   ├── .eslintrc.json               # SÓ react-hooks/rules-of-hooks como error
│   ├── index.html
│   ├── public/
│   │   ├── manifest.json            # PWA
│   │   ├── icon-192.png / icon-512.png / icon-maskable-512.png
│   │   └── logo.png
│   └── src/
│       ├── main.jsx                 # Bootstrap React + ErrorBoundary + Router
│       ├── App.jsx                  # Routes + Header + LegalFooter
│       ├── index.css                # Variáveis CSS globais + utility classes
│       ├── pages/
│       │   ├── Home.jsx
│       │   ├── Login.jsx
│       │   ├── Register.jsx
│       │   ├── Profile.jsx
│       │   ├── Dashboard.jsx
│       │   └── Admin.jsx            # Tabs internas (Dashboard/Game/Users/Logs/...)
│       ├── components/
│       │   ├── Header.jsx
│       │   ├── ErrorBoundary.jsx    # Captura crashes do React
│       │   ├── ProtectedRoute.jsx   # Gate de auth + role
│       │   └── ...
│       ├── context/
│       │   └── AuthContext.jsx      # Provider com login/logout/register/refresh
│       └── services/
│           └── api.js               # axios + interceptors (JWT + auto-refresh)
│
├── docker-compose.yml               # Production: 4 services + envs
├── docker-compose.dev.yml           # Override pra dev local
├── .env                             # NÃO commitar
└── ARQUITETURA.md                   # Este arquivo
```

---

## 🧩 4. Padrões do backend

### 4.1 Padrão Rota → Controller → Service

```javascript
// routes/user.js — define endpoint + validação + middlewares
router.delete(
  '/me',
  authenticate,                                              // 1. quem é
  adminSensitiveLimiter,                                     // 2. rate limit
  sanitizeBody,                                              // 3. limpa input
  [body('password').notEmpty().withMessage('...')],          // 4. valida formato
  validate,                                                  // 5. converte errors em 422
  deleteMyAccount                                            // 6. controller
);

// controllers/userController.js — request/response + regras
async function deleteMyAccount(req, res) {
  try {
    const { password } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    // valida senha
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Senha incorreta.' });
    // chama service ou lógica direta
    await anonymizeUser(user);
    res.json({ message: 'Conta excluída.' });
  } catch (err) {
    logger.safeError('Erro ao excluir conta', err);
    res.status(500).json({ error: 'Erro ao excluir conta.' });
  }
}
```

**Por quê:** separação clara entre "como entra um request" e "o que ele faz". Fácil testar controller sem subir Express.

### 4.2 Pattern de erro consistente

Todo controller retorna **JSON com `error` em PT-BR**:

```javascript
return res.status(409).json({ error: 'Mensagem clara pro usuário final.' });
```

Validação errors usam formato estruturado:

```javascript
// middlewares/validate.js
{ error: 'Dados inválidos.', details: [{ field: 'password', message: '...' }] }
```

Errors críticos vão pro `logger.safeError(msg, err)` que **não vaza dado sensível** nos logs.

### 4.3 Singleton do Prisma e Redis

```javascript
// services/prismaClient.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['warn', 'error'] });
process.on('beforeExit', () => prisma.$disconnect());
module.exports = { prisma };
```

```javascript
// services/redisClient.js
const { createClient } = require('redis');
const client = createClient({ url: process.env.REDIS_URL });
client.on('error', (err) => logger.warn('Redis error', { err: err.message }));
client.connect().catch(() => {});  // fail-open: app continua sem Redis
module.exports = client;
```

**Padrão:** se Redis cair, app **degrada** (rate limit some) mas **não morre**. Cada uso de Redis tem `if (client.isReady)` check.

### 4.4 Schedulers internos (sem cron externo)

```javascript
// server.js
setInterval(checkBettingCutoff, 60_000);           // a cada 60s
setInterval(checkPendingPayments, 3 * 60 * 1000);  // a cada 3 min
setInterval(autoSyncMegaSena, 30 * 60 * 1000);     // a cada 30 min
setInterval(cleanupOldLoginAttempts, 24 * 60 * 60 * 1000);
```

**Quando usar:** tarefas curtas que rodam dentro do processo Node. **Quando NÃO usar:** se o Node morrer ou tiver múltiplas instâncias, vai disparar duplicado/perder execução. Pra esses casos, usar cron externo ou queue (Bull).

### 4.5 Limpeza automática de dados temporários

`LoginAttempts > 30 dias` e `RefreshTokens expirados` são deletados todo dia. **Sempre tenha um job de limpeza** pra tabelas que crescem indefinidamente.

---

## ⚛ 5. Padrões do frontend

### 5.1 AuthContext + ProtectedRoute

```jsx
// context/AuthContext.jsx
const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(/* carrega do localStorage */);
  const login = useCallback(async (nick, pwd, totp) => { /* ... */ }, []);
  const logout = useCallback(async () => {
    await api.post('/auth/logout');  // adiciona token na blacklist Redis
    localStorage.clear(); setUser(null);
  }, []);
  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
}

// components/ProtectedRoute.jsx
export default function ProtectedRoute({ children, adminOnly }) {
  const { isAuthenticated, isAdmin } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  return children;
}
```

### 5.2 axios com auto-refresh

```javascript
// services/api.js
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED' && !originalRequest._retry) {
      originalRequest._retry = true;
      // tenta refresh, se OK refaz o request, se falha redireciona pra /login
    }
    return Promise.reject(error);
  }
);
```

**Truque:** uma `failedQueue` evita N refresh requests simultâneos quando várias chamadas batem 401 ao mesmo tempo.

### 5.3 ErrorBoundary global

Sempre envolva o app na raíz pra crash de render virar tela amigável ao invés de tela branca:

```jsx
// main.jsx
<ErrorBoundary>
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>
</ErrorBoundary>
```

E configure listener pra `unhandledrejection` pra promessas que ninguém pegou.

### 5.4 Regra de ouro do React Hooks

**TODO `useState`, `useEffect`, `useCallback`, etc. DEVE ser chamado ANTES de qualquer `return` antecipado.**

```jsx
// ❌ ERRADO — quebra o React (já me derrubou o site uma vez)
function Component() {
  const [x, setX] = useState(0);
  if (loading) return <Spinner />;     // <-- early return aqui
  useEffect(() => { ... }, []);        // <-- hook DEPOIS do return: BUG
}

// ✅ CERTO
function Component() {
  const [x, setX] = useState(0);
  useEffect(() => { ... }, []);        // <-- todos os hooks no topo
  if (loading) return <Spinner />;     // <-- early returns DEPOIS
}
```

A `.eslintrc.json` com `react-hooks/rules-of-hooks: error` rodando no Dockerfile bloqueia esse bug antes do deploy.

---

## 🗄 6. Banco de dados (Prisma + PostgreSQL)

### 6.1 Conventions

- **PK:** `String @id @default(uuid())` — impede enumeração via URL (`/ticket/1`, `/ticket/2`)
- **Timestamps:** sempre `createdAt`/`updatedAt`
- **Snake_case no banco, camelCase no Prisma:** `@map("password_hash")` + `@@map("users")`
- **Dinheiro:** `Decimal @db.Decimal(12, 2)` — nunca `Float`
- **Texto longo:** `@db.Text`
- **Arrays:** `Int[]` no Postgres (pra coisas simples como números sorteados)
- **JSON:** `Json @default("[]")` (pra estrutura flexível, mas evitar se possível)
- **Unique constraint pra evitar duplicata:** `@unique` no schema → migra em `CREATE UNIQUE INDEX`
- **Soft data:** nunca delete pagamentos/auditoria. Anonimize usuário ao invés de deletar.

### 6.2 Índices

Adicione índices nos hot paths **antes que a query fique lenta**:

```prisma
model Ticket {
  // ...
  @@index([gameId, status])                  // listagem por jogo + status
  @@index([userId, createdAt(sort: Desc)])   // histórico do usuário
}
```

### 6.3 Migrations

Use `prisma migrate` em dev, **mas em produção o backend roda `prisma migrate deploy` no boot** (no `command:` do docker-compose):

```yaml
command: >
  sh -c "
    npx prisma migrate deploy &&
    node prisma/seed.js &&
    node server.js
  "
```

Cada migration tem timestamp + nome descritivo: `20240107000000_legal_audit_cleanup/migration.sql`.

**Nunca edite uma migration já aplicada em produção.** Crie nova.

### 6.4 Seed de admin

`prisma/seed.js` cria o admin se não existir (idempotente):

```javascript
const ADMIN_NICKNAME = 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD;
const existing = await prisma.user.findUnique({ where: { nickname: ADMIN_NICKNAME } });
if (!existing) {
  await prisma.user.create({
    data: {
      nickname: ADMIN_NICKNAME,
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12),
      role: 'admin',
    },
  });
}
```

---

## 🔐 7. Autenticação & segurança

### 7.1 Senha

- `bcrypt` com `rounds=12` (~ 250ms de hash, OK pra UX, ruim pra bruteforce)
- Mínimo 8 chars + 1 maiúscula + 1 número (validado no front E no back)

### 7.2 JWT short-lived + refresh

- `accessToken`: 15 min, payload `{ sub, nickname, role }`
- `refreshToken`: 30 dias, armazenado no banco (tabela `refresh_tokens`)
- Logout: adiciona `accessToken` na **blacklist Redis** com TTL = tempo restante
- Trocou senha → revoga todos os refresh tokens daquele usuário

### 7.3 Rate limiting (Redis-backed)

Múltiplas instâncias com pesos diferentes:

| Endpoint | Limite | Janela |
|---|---|---|
| `/auth/login` | 5 falhas | 15 min |
| `/auth/register` | 10 | 1 h |
| `/auth/refresh` | 30 | 15 min |
| `/api/*` (geral) | 300 | 15 min |
| Públicos | 60 | 1 min |
| Admin sensitive | 10 | 1 h |

### 7.4 HTTP hardening (helmet)

```javascript
helmet({
  contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], ... } },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  // ...
})
// + Permissions-Policy desabilitando camera/mic/geo/payment/usb
// + Cache-Control: no-store em todas as rotas da API
```

### 7.5 2FA (TOTP) com secret cifrado

- Admin **obrigatório**. Player **opcional** (a configurar se quiser).
- Secret AES-256-GCM cifrado em repouso (key em `TOTP_ENCRYPTION_KEY` no `.env`)
- Formato armazenado: `v1:<iv_hex>:<tag_hex>:<ciphertext_hex>` (legível) — compatível com legacy plain text durante migração

### 7.6 CORS estrito

```javascript
const allowedOrigins = [process.env.FRONTEND_URL];  // nunca '*'
cors({ origin: (origin, cb) => allowedOrigins.includes(origin) ? cb(null, true) : cb(new Error(`CORS bloqueado: ${origin}`)) })
```

### 7.7 Auditoria

```javascript
// middlewares/admin.js
async function logAdminAction(adminId, action, details, ipAddress) {
  await prisma.adminLog.create({ data: { adminId, action, details, ipAddress } });
}
```

Toda ação admin (criar/deletar/aprovar) chama `logAdminAction()`. Trilha de auditoria pra LGPD/disputa.

### 7.8 LGPD: anonimização de conta

```javascript
// userController.deleteMyAccount
await prisma.user.update({
  where: { id: user.id },
  data: {
    nickname: `deleted_${user.id.slice(0, 8)}`,  // marcador único
    passwordHash: await bcrypt.hash(crypto.randomBytes(48).toString('hex'), 12),  // impossível logar
    whatsapp: null,
    cpf: null,
    totpSecret: null,
    isActive: false,
  },
});
// Cartelas/pagamentos preservados (auditoria fiscal), sem dado pessoal
```

---

## 💳 8. Integração de pagamento (PIX via Mercado Pago)

### 8.1 Padrões essenciais

1. **Idempotency-key** em toda criação de cobrança (uuid v4) — sem isso, retry duplica cobrança
2. **Webhook valida assinatura HMAC** — rejeita request sem `x-signature` ou inválida
3. **Polling fallback** — a cada 3 min, varre pagamentos pendentes e consulta status no MP (webhook pode falhar)
4. **Idempotente no processamento** — receber webhook 5x = uma aprovação só

```javascript
// server.js — webhook precisa do body raw
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// paymentService.js
async function processPaymentUpdate(payment, mpStatus) {
  if (payment.status === 'approved') return;  // já processado, idempotente
  if (mpStatus.status === 'approved') {
    await prisma.$transaction([
      prisma.payment.update({ where: { id: payment.id }, data: { status: 'approved', paidAt: new Date() } }),
      prisma.ticket.update({ where: { id: payment.ticketId }, data: { status: 'active' } }),
      prisma.game.update({ where: { id: payment.gameId }, data: { totalPot: { increment: payment.amount } } }),
    ]);
  }
}
```

### 8.2 Pagamento manual (admin)

Sempre permita admin aprovar pagamento manualmente (caso PIX falhe ou cliente pague por fora). Endpoint registra no AdminLog.

### 8.3 Auditoria de prêmio pago

```prisma
model Ticket {
  prizePaidAt        DateTime?
  prizePaidByAdminId String?
  prizePaymentNotes  String?  @db.Text
}
```

Admin clica "Marcar pago" → grava timestamp + admin + nota (ID da transação PIX). Trilha contra disputa "não recebi".

---

## 🚢 9. Deploy (Docker + VPS + nginx + Let's Encrypt)

### 9.1 docker-compose.yml resumido

```yaml
services:
  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 128mb --maxmemory-policy allkeys-lru --save ""
    networks: [backend_net]

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes: [postgres_data:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s

  backend:
    build: ./backend
    command: >
      sh -c "npx prisma migrate deploy && node prisma/seed.js && node server.js"
    depends_on:
      db: { condition: service_healthy }
      redis: { condition: service_started }
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
      JWT_SECRET: ${JWT_SECRET}
      TOTP_ENCRYPTION_KEY: ${TOTP_ENCRYPTION_KEY}
      # ...
    volumes: [backend_logs:/app/logs]
    networks: [backend_net]
    expose: ["3001"]

  frontend:
    build:
      context: ./frontend
      args: { VITE_API_URL: /api }
    depends_on: [backend]
    networks: [frontend_net, backend_net]
    ports: ["3000:80"]
```

### 9.2 Dockerfile backend (multi-stage)

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat

FROM base AS deps
COPY package*.json ./
RUN npm install

FROM deps AS builder
COPY . .
RUN npx prisma generate

FROM base AS runner
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder /app /app
RUN mkdir -p /app/logs && chown -R appuser:appgroup /app
USER appuser
CMD ["node", "server.js"]
```

### 9.3 Dockerfile frontend (build + nginx)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run lint       # ← guard: bloqueia deploy se quebrar Rules of Hooks
RUN npm run build

FROM nginx:1.27-alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/app.conf
```

### 9.4 nginx.conf (frontend container)

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  # Headers de segurança
  add_header X-Frame-Options "DENY" always;
  add_header X-Content-Type-Options "nosniff" always;

  # Cache longo pra assets com hash
  location ~* \.(js|css|png|jpg|svg|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  # Proxy de API pro backend
  location /api/ {
    proxy_pass http://backend:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # SPA fallback
  location / { try_files $uri $uri/ /index.html; }
}
```

### 9.5 nginx do host + SSL

```nginx
# /etc/nginx/sites-enabled/seuapp
server {
  server_name seuapp.com.br www.seuapp.com.br;
  location / {
    proxy_pass http://localhost:3000;     # porta exposta pelo frontend container
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
  listen 443 ssl;  # managed by Certbot
  ssl_certificate /etc/letsencrypt/live/seuapp.com.br/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/seuapp.com.br/privkey.pem;
}
server {
  if ($host = seuapp.com.br) { return 301 https://$host$request_uri; }
  listen 80;
  return 404;
}
```

Comando pra rodar Certbot:
```bash
sudo certbot --nginx -d seuapp.com.br -d www.seuapp.com.br
```

### 9.6 Deploy script (Python paramiko ou shell)

```bash
# deploy.sh
scp -r backend frontend docker-compose.yml root@vps:/root/app/
ssh root@vps "cd /root/app && docker compose up -d --no-deps --build backend frontend"
```

Em projeto sério: GitHub Actions com SSH. Em MVP: script local roda.

---

## 🛠 10. Operacional (backup, health, logs)

### 10.1 Backup automático

`/root/app-backup.sh` rodando via cron diário:

```bash
#!/bin/bash
set -euo pipefail
umask 077  # arquivos criados com 600

BACKUP_ROOT="/root/app-backups"
DAILY="$BACKUP_ROOT/daily"
WEEKLY="$BACKUP_ROOT/weekly"
TS=$(date +%Y-%m-%d_%H%M)

mkdir -p "$DAILY" "$WEEKLY"

# Dump comprimido
docker exec app_db pg_dump -U user -d dbname --no-owner --no-acl | gzip -9 > "$DAILY/db_$TS.sql.gz"

# Logs
tar -czf "$DAILY/logs_$TS.tar.gz" -C /var/lib/docker/volumes/app_logs/_data .

# Snapshot semanal (domingo)
[ "$(date +%u)" = "7" ] && cp -p "$DAILY/db_$TS.sql.gz" "$WEEKLY/db_week_$TS.sql.gz"

# Rotação
find "$DAILY" -mtime +7 -delete
find "$WEEKLY" -mtime +28 -delete
```

```cron
0 6 * * * /root/app-backup.sh >> /var/log/app-backup.log 2>&1
```

**Pra produção séria:** adicione `rclone copy` ou similar pro Backblaze B2 / S3.

### 10.2 Health checks

```javascript
// server.js
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.get('/health/deep', async (req, res) => {
  const result = { status: 'ok', checks: {} };
  try {
    await Promise.race([prisma.$queryRaw`SELECT 1`, timeout(3000)]);
    result.checks.db = { status: 'ok' };
  } catch { result.checks.db = { status: 'fail' }; result.status = 'degraded'; }
  // ... same pra Redis
  res.status(result.status === 'ok' ? 200 : 503).json(result);
});
```

Aponte UptimeRobot/Healthchecks.io pra `/health/deep`.

### 10.3 Logger seguro

```javascript
// utils/logger.js
function safeError(msg, err, extra = {}) {
  logger.error(msg, {
    message: err?.message,
    stack: process.env.NODE_ENV === 'production' ? '<elided>' : err?.stack,
    // NUNCA loga req.body, headers, password
    ...extra,
  });
}
```

### 10.4 Permissões do .env

```bash
chmod 600 /root/app/.env
chown root:root /root/app/.env
```

E **nunca commita** `.env` no Git.

---

## 🧪 11. Workflow de desenvolvimento

### 11.1 Lint guard no Dockerfile

`.eslintrc.json`:

```json
{
  "root": true,
  "env": { "browser": true, "es2022": true, "node": true },
  "parserOptions": { "ecmaVersion": "latest", "sourceType": "module", "ecmaFeatures": { "jsx": true } },
  "plugins": ["react-hooks"],
  "rules": {
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "off"
  },
  "ignorePatterns": ["dist", "node_modules", "*.config.js"]
}
```

`package.json`:

```json
"scripts": {
  "lint": "eslint src --ext .js,.jsx --max-warnings 0"
}
```

`Dockerfile`:

```dockerfile
RUN npm run lint   # bloqueia build se quebrar Rules of Hooks
RUN npm run build
```

### 11.2 Convenção de migrations

1. Editou `schema.prisma` → roda local `npx prisma migrate dev --name nome_curto_descritivo`
2. Commit junto com a feature
3. Em produção: backend dá `migrate deploy` no boot, automático

### 11.3 Pre-commit (opcional mas recomendado)

```bash
# .husky/pre-commit
cd frontend && npm run lint
```

### 11.4 Testes (lacuna conhecida deste projeto)

Não tem teste automatizado. Em projeto sério: vitest + supertest pro backend, vitest + testing-library pro frontend. Smoke test via script Python serve pra MVP mas não escala.

---

## ✅ 12. Checklist pra começar projeto novo

Quando você for clonar essa arquitetura pra outro projeto:

### Setup inicial
- [ ] `git init` + `.gitignore` (node_modules, .env, dist, *.log)
- [ ] Copiar estrutura de pastas
- [ ] `package.json` com deps mínimas (ver acima)
- [ ] `docker-compose.yml` + `Dockerfile`s
- [ ] `.env.example` com TODAS as vars necessárias

### Banco
- [ ] `schema.prisma` com User, RefreshToken, AdminLog, LoginAttempt (sempre tem)
- [ ] Primeira migration (init)
- [ ] `seed.js` que cria admin se não existir
- [ ] Índices nos hot paths

### Backend baseline
- [ ] helmet + cors + compression + morgan + rate-limit-redis
- [ ] `authenticate` + `requireAdmin` + `logAdminAction`
- [ ] `validate.js` + `sanitizeBody`
- [ ] `errorHandler.js` + `notFoundHandler`
- [ ] `/health` + `/health/deep`
- [ ] `register` / `login` / `logout` / `refresh` (JWT + blacklist Redis)
- [ ] `/users/me` (GET/PATCH/DELETE)
- [ ] `prisma/seed.js`
- [ ] Schedulers necessários (limpeza, etc.)

### Frontend baseline
- [ ] Vite + React 18 + react-router-dom + axios + react-hot-toast
- [ ] `AuthContext` + `ProtectedRoute`
- [ ] `api.js` com auto-refresh
- [ ] `ErrorBoundary`
- [ ] `Login` + `Register` + `Profile`
- [ ] `.eslintrc.json` com Rules of Hooks
- [ ] `manifest.json` + ícones PWA

### Segurança
- [ ] Gerar `JWT_SECRET`, `JWT_REFRESH_SECRET`, `TOTP_ENCRYPTION_KEY` (32 bytes cada)
- [ ] `bcrypt rounds=12`
- [ ] Rate limit em login/register/refresh
- [ ] CORS restrito ao `FRONTEND_URL`
- [ ] Helmet com CSP estrita
- [ ] `chmod 600` no `.env`

### Deploy
- [ ] VPS Ubuntu 22.04+ com Docker + Compose
- [ ] nginx do host (proxy reverso) + certbot
- [ ] DNS apontando pro IP
- [ ] `docker compose up -d --build`
- [ ] Verificar `/health/deep` = 200

### Operacional
- [ ] Script de backup + cron diário
- [ ] UptimeRobot apontando pra `/health/deep`
- [ ] (opcional) GitHub Actions pra CI/CD

---

## ❌ 13. O que NÃO copiar / armadilhas

**Coisas deste projeto que NÃO valem replicar:**

1. **Scripts de deploy `.py` espalhados na raiz** — vire um único `deploy.sh` ou GitHub Actions
2. **Configurações estáticas hardcoded em `.js`** (ex: `frontend/src/config/bolao.js` com datas) — use sempre o backend
3. **`hitHistory Json` no Ticket** — modelagem preguiçosa. Em projeto novo, faz tabela própria
4. **Falta de testes** — comece com vitest desde o dia 1
5. **`User.balance` que nunca foi usado** — quando criar campo, **só crie quando for usar**
6. **Frontend e backend acoplados pelo `/api/` proxy do nginx** — funciona, mas hoje em dia separar (frontend num CDN, backend num domínio próprio) é mais limpo
7. **Cron embutido no Node (`setInterval`)** — pra projeto novo, considere Bull/BullMQ desde o início se prevê várias jobs

**Armadilhas conhecidas:**

- **Rules of Hooks após early return** — derruba o site inteiro. Lint guard obrigatório.
- **Webhook do MP sem assinatura** — sites fraudulentos vão simular pagamentos. SEMPRE validar.
- **`docker compose down`** em produção sem cuidado — apaga containers, mantém volumes, mas service down até `up` de novo. Use `restart` ou `up -d --build` ao invés.
- **Migration esquecida em prod** — `prisma migrate deploy` no `command:` do backend resolve, mas verifique no log do boot
- **`.env` sem `chmod 600`** — `cat /etc/passwd` mostra `/root/`, mas e se outro user existir? Vacina barata.
- **TOTP secret em texto puro no banco** — backup vaza, attacker tem 2FA. Sempre cifrar.
- **Backup só na própria VPS** — disco da VPS pifa, backup pifa junto. Off-site é mandatório pra produção real.

---

## 📌 Apêndice: variáveis de ambiente mínimas

```env
# Database
POSTGRES_DB=appname
POSTGRES_USER=appuser
POSTGRES_PASSWORD=<random 32+ chars>
DATABASE_URL=postgresql://appuser:senha@db:5432/appname

# Auth
JWT_SECRET=<openssl rand -hex 32>
JWT_REFRESH_SECRET=<openssl rand -hex 32>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d
BCRYPT_ROUNDS=12

# 2FA
TOTP_ENCRYPTION_KEY=<openssl rand -hex 32>
ADMIN_TOTP_ISSUER=NomeDoApp

# Admin inicial
ADMIN_INITIAL_PASSWORD=<senha forte temp>

# URLs
FRONTEND_URL=https://seuapp.com.br
BACKEND_URL=https://seuapp.com.br

# Redis
REDIS_URL=redis://redis:6379

# Pagamento (se aplicável)
MP_ACCESS_TOKEN=<token MP>
MP_WEBHOOK_SECRET=<secret MP>

# Contato
ADMIN_WHATSAPP=5511999999999

# Log
LOG_LEVEL=info
LOG_DIR=/app/logs
NODE_ENV=production
PORT=3001
```

Gere secrets seguros:
```bash
openssl rand -hex 32   # cada secret separado
```

---

**Última revisão:** maio/2026 — durante migração que adicionou CPF, prize tracking, TOTP encryption, backup automático.
**Autor mental:** baseado em decisões da arquitetura GoPremiada.
