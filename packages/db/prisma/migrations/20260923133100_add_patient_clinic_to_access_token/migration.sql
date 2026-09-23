-- AlterTable
ALTER TABLE "access_tokens" ADD COLUMN "patient_id" TEXT;
ALTER TABLE "access_tokens" ADD COLUMN "clinic_id" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "access_tokens_patient_id_idx" ON "access_tokens"("patient_id");
CREATE INDEX IF NOT EXISTS "access_tokens_clinic_id_idx" ON "access_tokens"("clinic_id");

-- AddForeignKey
ALTER TABLE "access_tokens" ADD CONSTRAINT "access_tokens_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_tokens" ADD CONSTRAINT "access_tokens_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
