FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build de produção (variáveis injetadas no build via ARG)
ARG VITE_API_URL=/api
ARG VITE_ADMIN_WHATSAPP=5517997088020
ARG VITE_PIX_KEY=17991571909
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_ADMIN_WHATSAPP=$VITE_ADMIN_WHATSAPP
ENV VITE_PIX_KEY=$VITE_PIX_KEY

# Lint guard — falha o build se houver violação das Rules of Hooks.
# Bloqueia que bugs como "useEffect depois de early return" cheguem em produção.
RUN npm run lint

RUN npm run build

# Servir com Nginx
FROM nginx:1.27-alpine AS runner

# Remove config padrão
RUN rm /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/app.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
