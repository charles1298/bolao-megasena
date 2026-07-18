-- AddColumn: betting_locked to games
ALTER TABLE "games" ADD COLUMN IF NOT EXISTS "betting_locked" BOOLEAN NOT NULL DEFAULT false;
