-- CPF (LGPD + verificação +18 + IRRF para prêmios)
-- Nullable: usuários antigos podem completar depois pelo perfil. Novos cadastros validam na app.
ALTER TABLE "users" ADD COLUMN "cpf" VARCHAR(11);
CREATE UNIQUE INDEX "users_cpf_key" ON "users"("cpf") WHERE "cpf" IS NOT NULL;

-- Auditoria de prêmio pago — admin marca quando paga o PIX por fora.
-- Sem isso não tem prova se um ganhador alegar "não recebi".
ALTER TABLE "tickets" ADD COLUMN "prize_paid_at" TIMESTAMP(3);
ALTER TABLE "tickets" ADD COLUMN "prize_paid_by_admin_id" TEXT;
ALTER TABLE "tickets" ADD COLUMN "prize_payment_notes" TEXT;

-- Código morto: User.balance nunca foi usado pela aplicação
ALTER TABLE "users" DROP COLUMN "balance";

-- Índices em hot paths — listagem de cartelas e logs ficam lentas sem
CREATE INDEX "tickets_game_id_status_idx" ON "tickets"("game_id", "status");
CREATE INDEX "tickets_user_id_created_at_idx" ON "tickets"("user_id", "created_at" DESC);
CREATE INDEX "payments_status_created_at_idx" ON "payments"("status", "created_at");
CREATE INDEX "admin_logs_admin_id_created_at_idx" ON "admin_logs"("admin_id", "created_at" DESC);
