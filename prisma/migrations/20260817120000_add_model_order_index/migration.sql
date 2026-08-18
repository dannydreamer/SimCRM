-- AlterTable
ALTER TABLE "SimulationModel" ADD COLUMN "orderIndex" INTEGER NOT NULL DEFAULT 0;

-- Seed the manual order from the alphabetical order the list showed until now,
-- so nothing appears to move until a manager actually reorders it.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name ASC) AS rn
  FROM "SimulationModel"
)
UPDATE "SimulationModel" m
SET "orderIndex" = ranked.rn
FROM ranked
WHERE m.id = ranked.id;
