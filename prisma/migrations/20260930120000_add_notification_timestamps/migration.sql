-- Notification window (spec §4.7.1)
--
-- Three timestamps to go with the three warning booleans. The booleans say
-- whether a warning stands; these say when it was raised, which is what the
-- 14-day window measures against.
--
-- Supabase's transaction pooler rejects DDL through Prisma's prepared
-- statements, so run this in the SQL Editor and then record it in
-- _prisma_migrations by hand. See spec §2.2.
--
-- Run the ALTERs and the UPDATEs in ONE session. A workshop cancelled between
-- the two steps would otherwise get neither the old behaviour nor the new, and
-- its alert would vanish silently.

ALTER TABLE "Workshop" ADD COLUMN "cancelledAt"            TIMESTAMP(3);
ALTER TABLE "Workshop" ADD COLUMN "postponedWarningAt"     TIMESTAMP(3);
ALTER TABLE "Workshop" ADD COLUMN "roomCancelledWarningAt" TIMESTAMP(3);

-- Keep the alerts that are still live.
--
-- Nothing in the database records when a workshop was cancelled: Workshop has
-- no updatedAt, and cancellation writes no CastingChangeLog row. So the real
-- timestamps cannot be recovered, and "still live" has to be judged by proxy —
-- a future workshop date. An alert someone still has to act on is one for a
-- workshop that has not happened yet.
--
-- Stamping now() gives those a full 14 days, so the team sees each one until
-- somebody dismisses it. Some will be alerts that were already handled weeks
-- ago; that costs a click. The alternative — leaving every row NULL — silences
-- a workshop cancelled five minutes before the migration, and there is no way
-- to get that banner back, because cancellation is irreversible and a cancelled
-- workshop is view-only. A spurious banner is cheap; a missing one puts a group
-- in a room for a workshop that was called off.
--
-- Past-dated rows stay NULL and stay silent, which is what clears the backlog.

UPDATE "Workshop" SET "cancelledAt"            = now() WHERE "cancelled"            AND "date" >= now();
UPDATE "Workshop" SET "postponedWarningAt"     = now() WHERE "postponedWarning"      AND "date" >= now();
UPDATE "Workshop" SET "roomCancelledWarningAt" = now() WHERE "roomCancelledWarning"  AND "date" >= now();

-- Production, 10 Oct 2026: 14 cancelled workshops of which 8 future-dated,
-- 3 postponement warnings, 0 room-cancellation warnings — so 11 alerts carried
-- forward and 6 historical cancellations retired.
