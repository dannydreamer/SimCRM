-- Audit: castings sitting in slots that no longer exist.
--
-- Gate for Part 5 of the casting-staleness work (spec §7.2.1 / §7.4): making
-- `castingProgress` slot-aware instead of count-based. Today it compares totals,
-- so a casting whose (scenario, room, slotGender, slotIndex) is out of range still
-- counts as filled. Making it slot-aware is correct, but any workshop already
-- holding such a row would flip from ליהוק הושלם to incomplete and drop out of
-- מוכן the next time anything touches it.
--
-- Run this READ-ONLY query against production in the Supabase SQL editor.
--   0 rows  → nothing in flight is affected; Part 5 is safe to ship.
--   >0 rows → look at them first; Parts 1–4 do not depend on Part 5.
--
-- CLOSED workshops are excluded: their status is driven by letters and feedback,
-- not by the READY conditions, so slot-aware progress cannot move them.

SELECT
  w.id                     AS workshop_id,
  w.date::date             AS workshop_date,
  w.status,
  pg.name                  AS group_name,
  s."orderIndex" + 1       AS scenario_no,
  s.cancelled              AS scenario_cancelled,
  r."roomNumber",
  r.cancelled              AS room_cancelled,
  c."slotGender",
  c."slotIndex",
  s."maleActorsNeeded",
  s."femaleActorsNeeded"
FROM "Casting" c
JOIN "Scenario"         s  ON s.id  = c."scenarioId"
JOIN "Workshop"         w  ON w.id  = c."workshopId"
JOIN "ParticipantGroup" pg ON pg.id = w."participantGroupId"
LEFT JOIN "Room"        r  ON r.id  = c."roomId"
WHERE c."isDirector" = false
  AND w.cancelled = false
  AND w.status <> 'CLOSED'
  AND (
       (c."slotGender" = 'MALE'   AND c."slotIndex" >= s."maleActorsNeeded")
    OR (c."slotGender" = 'FEMALE' AND c."slotIndex" >= s."femaleActorsNeeded")
  )
ORDER BY w.date DESC, scenario_no, c."slotGender", c."slotIndex";
