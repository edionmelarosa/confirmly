-- Phase 6: followups, recurrence rules, session-capacity scheduling

CREATE TYPE "SchedulingMode" AS ENUM ('fixed_time', 'session_capacity');
CREATE TYPE "SessionOfDay" AS ENUM ('am', 'pm');
CREATE TYPE "RecurrenceRuleType" AS ENUM ('every_n_weeks', 'day_of_month');
CREATE TYPE "RecurrenceRuleStatus" AS ENUM ('active', 'paused', 'cancelled');

ALTER TABLE "clinics"
  ADD COLUMN "scheduling_mode" "SchedulingMode" NOT NULL DEFAULT 'fixed_time',
  ADD COLUMN "session_capacity_am" INTEGER,
  ADD COLUMN "session_capacity_pm" INTEGER,
  ADD COLUMN "session_am_start_hour" INTEGER NOT NULL DEFAULT 8,
  ADD COLUMN "session_am_end_hour" INTEGER NOT NULL DEFAULT 12,
  ADD COLUMN "session_pm_start_hour" INTEGER NOT NULL DEFAULT 13,
  ADD COLUMN "session_pm_end_hour" INTEGER NOT NULL DEFAULT 18;

CREATE TABLE "recurrence_rules" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "resource_id" TEXT,
    "rule_type" "RecurrenceRuleType" NOT NULL,
    "interval_weeks" INTEGER,
    "day_of_month" INTEGER,
    "duration_minutes" INTEGER NOT NULL DEFAULT 30,
    "session_of_day" "SessionOfDay",
    "status" "RecurrenceRuleStatus" NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "recurrence_rules_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "appointments"
  ADD COLUMN "follow_up_of_appointment_id" TEXT,
  ADD COLUMN "recurrence_rule_id" TEXT,
  ADD COLUMN "session_of_day" "SessionOfDay",
  ADD COLUMN "is_session_capacity" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "appointments_follow_up_of_appointment_id_idx" ON "appointments"("follow_up_of_appointment_id");
CREATE INDEX "appointments_recurrence_rule_id_idx" ON "appointments"("recurrence_rule_id");
CREATE INDEX "recurrence_rules_clinic_id_patient_id_idx" ON "recurrence_rules"("clinic_id", "patient_id");

ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rules_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rules_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "appointments" ADD CONSTRAINT "appointments_follow_up_of_appointment_id_fkey" FOREIGN KEY ("follow_up_of_appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_recurrence_rule_id_fkey" FOREIGN KEY ("recurrence_rule_id") REFERENCES "recurrence_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "appointments" DROP CONSTRAINT "appointments_no_overlap";
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_no_overlap" EXCLUDE USING gist (
    "clinic_id" WITH =,
    COALESCE("resource_id", '') WITH =,
    tstzrange("starts_at", "ends_at") WITH &&
) WHERE (status NOT IN ('cancelled', 'no_show') AND is_session_capacity = false);
