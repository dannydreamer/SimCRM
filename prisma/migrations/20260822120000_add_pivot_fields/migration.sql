-- טבלאות פיבוט (spec §8.12).
--
-- Both columns are nullable and additive, so production's currently-running code
-- is unaffected by applying this ahead of the deploy.
--
-- No backfill. חדרים לספירה derives its default from `status`, which is already
-- frozen at the moment of cancellation on every existing row — cancelling writes
-- `cancelled` and never touches `status`, checkAndAdvanceStatus() returns early
-- for a cancelled workshop, and there is no un-cancel path. Historical rows
-- therefore compute the correct default with no migration of their own.

-- AlterTable
ALTER TABLE "Workshop" ADD COLUMN "pivotNotes" TEXT;
ALTER TABLE "Workshop" ADD COLUMN "countedRoomsOverride" INTEGER;
