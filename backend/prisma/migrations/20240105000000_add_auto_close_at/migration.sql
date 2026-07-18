-- AddColumn: auto_close_at to games (nullable DateTime for automatic betting cutoff)
ALTER TABLE "games" ADD COLUMN IF NOT EXISTS "auto_close_at" TIMESTAMP(3);
