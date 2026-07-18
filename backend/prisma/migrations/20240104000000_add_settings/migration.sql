CREATE TABLE IF NOT EXISTS "settings" (
  "key"        TEXT NOT NULL,
  "value"      TEXT NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

INSERT INTO "settings" ("key", "value", "updated_at") VALUES
  ('data_inicio',     '2026-05-20T19:00:00', NOW()),
  ('data_fechamento', '2026-05-30T23:59:00', NOW())
ON CONFLICT ("key") DO NOTHING;
