-- אימון שחקנים (spec §3.5.1)
--
-- Plain ADD COLUMNs, no enum change. If `prisma migrate deploy` hangs on the
-- Supabase pooler anyway, run this in the SQL Editor and record it in
-- _prisma_migrations by hand. See spec §2.2.
--
-- Run all three statements in ONE session: a workshop sent to casting between
-- the ALTER and the UPDATE would keep a default nobody chose.

ALTER TABLE "Workshop" ADD COLUMN "trainingOffsetMinutes" INTEGER DEFAULT -60;
ALTER TABLE "Workshop" ADD COLUMN "trainingOnZoom" BOOLEAN NOT NULL DEFAULT false;

-- The ADD COLUMN DEFAULT gave every row the hour-before default. Workshops that
-- were already sent to casting go back to empty: their actors were told a time
-- the system never recorded, and printing a guessed one beside them would read
-- as fact. The Tech can fill one in by hand.
UPDATE "Workshop" SET "trainingOffsetMinutes" = NULL WHERE "castingSentAt" IS NOT NULL;
