-- משימות נוספות — the Tech's pre-workshop checklist (spec §4.3.1).
--
-- Six booleans, all NOT NULL DEFAULT false, so every existing row gets false
-- without a backfill statement.
--
-- **No backfill, and none is needed.** These are blocking READY conditions, so
-- the obvious worry is that applying this regresses every מוכן workshop to
-- בוצע איתור צרכים the moment checkAndAdvanceStatus() next runs. It does not
-- reach historical rows: the CLOSING and CLOSED branches of that function never
-- evaluate the READY conditions at all (CLOSING → CLOSED gates on letters only,
-- and CLOSED → CLOSING regresses only when a letter is unchecked), and the
-- readiness alert returns null for any status other than NEW/SPECIFIED and for
-- any past date. A past workshop is therefore untouched whatever these columns
-- say.
--
-- What *is* affected, deliberately, is every future-dated workshop: it now needs
-- these boxes ticked before it can reach מוכן, and any that is currently מוכן
-- regresses at the next mutation. That is the intended behaviour of the feature,
-- not a migration artefact — but it means the Techs see a batch of unticked
-- boxes on near-term workshops the first time they open them after the deploy.
--
-- Ordering, labels, and the fact that `propsPrepared` applies only to EXTERNAL
-- workshops all live in src/lib/workshop-minor-tasks.ts, never in the database.

-- AlterTable
ALTER TABLE "Workshop" ADD COLUMN "tiktakOrdered"    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Workshop" ADD COLUMN "namesReceived"    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Workshop" ADD COLUMN "scheduleSent"     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Workshop" ADD COLUMN "scenariosPrinted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Workshop" ADD COLUMN "summariesPrinted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Workshop" ADD COLUMN "propsPrepared"    BOOLEAN NOT NULL DEFAULT false;
