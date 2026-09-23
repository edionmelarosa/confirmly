-- Clinic business days/hours; patient booking only offers slots inside them.
ALTER TABLE "clinics"
  ADD COLUMN "open_days" INTEGER[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5, 6]::INTEGER[],
  ADD COLUMN "open_hour" INTEGER NOT NULL DEFAULT 8,
  ADD COLUMN "close_hour" INTEGER NOT NULL DEFAULT 18;

-- Session clinics: business hours span the existing morning start → afternoon end.
UPDATE "clinics"
SET "open_hour" = "session_am_start_hour", "close_hour" = "session_pm_end_hour"
WHERE "scheduling_mode" = 'session_capacity';
