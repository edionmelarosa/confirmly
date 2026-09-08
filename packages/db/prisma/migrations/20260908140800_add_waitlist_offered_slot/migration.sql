-- AlterTable
ALTER TABLE "waitlist_entries" ADD COLUMN     "offered_resource_id" TEXT,
ADD COLUMN     "offered_slot_end" TIMESTAMP(3),
ADD COLUMN     "offered_slot_start" TIMESTAMP(3);
