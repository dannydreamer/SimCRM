-- משימות נוספות — task 2, נפתחה קבוצת וואטסאפ (spec §4.3.1).
--
-- A seventh blocking task, inserted between הוזמן בתיקתק and שמות התקבלו. New
-- workshops start unticked, like the other six.
--
-- **Existing workshops are backfilled, unlike in 20260915120000_add_minor_tasks**,
-- because here a backfill can be derived rather than guessed. Tasks
-- לוח זמנים + נשלח בקבוצה and תרחישים הודפסו + נשלחו בקבוצה both say the thing
-- was sent *to the group*, so a workshop with either ticked demonstrably has
-- one. Every מוכן workshop has both ticked, so none of them regresses — which
-- matters because checkAndAdvanceStatus() is pull-based, and a regression would
-- otherwise sit unseen behind a stale מוכן (with no readiness alert, which is
-- silent for READY) until someone happened to open the workshop.
--
-- Workshops already past, or in בתהליך סגירה / סגור, are ticked too, so the
-- overlay on a historical workshop does not show an outstanding box forever.
-- (Nothing there would gate anything — see the earlier migration — this is
-- purely so history reads as done.)
--
-- Everything else — future workshops with neither group task ticked — stays
-- false, and shows the new task as outstanding. That is the intended behaviour.

-- AlterTable
ALTER TABLE "Workshop" ADD COLUMN "whatsappGroupOpened" BOOLEAN NOT NULL DEFAULT false;

-- Backfill
UPDATE "Workshop"
SET "whatsappGroupOpened" = true
WHERE "scheduleSent" = true
   OR "scenariosPrinted" = true
   OR "status" IN ('CLOSING', 'CLOSED')
   OR "date" < date_trunc('day', now());
