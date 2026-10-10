-- אימון שחקנים — the Tech's alert when the training changes (spec §3.5.1)
--
-- When the training last moved on its own. Null on every existing row: nothing
-- has moved yet, so there is no backlog to carry forward.

ALTER TABLE "Workshop" ADD COLUMN "trainingChangedAt" TIMESTAMP(3);
