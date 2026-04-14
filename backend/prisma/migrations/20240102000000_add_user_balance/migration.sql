-- AddColumn: balance to users
ALTER TABLE "users" ADD COLUMN "balance" DECIMAL(12,2) NOT NULL DEFAULT 0;
