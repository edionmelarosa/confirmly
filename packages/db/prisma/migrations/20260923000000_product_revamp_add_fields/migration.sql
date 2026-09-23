-- Product revamp: add manage/invite_to_book token purposes, reminder_lead_days, patient schedule fields

-- Add new access token purposes
ALTER TYPE "AccessTokenPurpose" ADD VALUE IF NOT EXISTS 'manage';
ALTER TYPE "AccessTokenPurpose" ADD VALUE IF NOT EXISTS 'invite_to_book';

-- Add reminder_lead_days to clinics (keeping hours for backward compatibility during transition)
ALTER TABLE "clinics" ADD COLUMN "reminder_lead_days" INTEGER NOT NULL DEFAULT 1;

-- Add patient schedule and service fields
ALTER TABLE "patients"
  ADD COLUMN "schedule_type" TEXT,
  ADD COLUMN "schedule_details" TEXT,
  ADD COLUMN "next_schedule" TIMESTAMP(3),
  ADD COLUMN "service" TEXT;
