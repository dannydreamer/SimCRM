-- Notification window (spec §4.7.1)
--
-- Three timestamps to go with the three warning booleans. The booleans say
-- whether a warning stands; these say when it was raised, which is what the
-- 14-day window measures against.
--
-- Deliberately left NULL for every existing row. NULL reads as "no event
-- recorded", which shows nothing — so applying this migration clears the entire
-- historical backlog of cancellation, postponement and room-cancellation
-- banners for everyone, in one step, without touching the booleans that the
-- strikethrough and the ⚠ marks still read.
--
-- Supabase's transaction pooler rejects DDL through Prisma's prepared
-- statements, so run this in the SQL Editor and then record it in
-- _prisma_migrations by hand. See spec §2.2.

ALTER TABLE "Workshop" ADD COLUMN "cancelledAt"            TIMESTAMP(3);
ALTER TABLE "Workshop" ADD COLUMN "postponedWarningAt"     TIMESTAMP(3);
ALTER TABLE "Workshop" ADD COLUMN "roomCancelledWarningAt" TIMESTAMP(3);

-- OPTIONAL — only if you want warnings on *future* workshops to survive the
-- deploy instead of going quiet with the rest. Gives them a fresh 14 days.
-- Skip both statements to start completely clean.
--
--   UPDATE "Workshop" SET "postponedWarningAt" = now()
--    WHERE "postponedWarning" AND "date" >= now();
--
--   UPDATE "Workshop" SET "roomCancelledWarningAt" = now()
--    WHERE "roomCancelledWarning" AND "date" >= now();
--
-- cancelledAt is deliberately not offered here: a cancellation old enough to
-- predate this migration has already been communicated by phone, and a banner
-- about it is noise.
