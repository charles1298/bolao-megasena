-- CreateIndex
-- Garante que cada WhatsApp seja usado em no máximo uma conta.
-- NULL não conta como duplicata no Postgres, então usuários sem WhatsApp continuam ok.
CREATE UNIQUE INDEX "users_whatsapp_key" ON "users"("whatsapp");
