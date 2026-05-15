-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Casting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workshopId" TEXT NOT NULL,
    "scenarioId" TEXT,
    "roomId" TEXT,
    "actorId" TEXT NOT NULL,
    "isDirector" BOOLEAN NOT NULL DEFAULT false,
    "slotGender" TEXT,
    "slotIndex" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Casting_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Casting_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Casting_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Casting_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Actor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Casting" ("actorId", "id", "isDirector", "roomId", "scenarioId", "workshopId") SELECT "actorId", "id", "isDirector", "roomId", "scenarioId", "workshopId" FROM "Casting";
DROP TABLE "Casting";
ALTER TABLE "new_Casting" RENAME TO "Casting";
CREATE TABLE "new_Scenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workshopId" TEXT NOT NULL,
    "name" TEXT,
    "topicId" TEXT NOT NULL,
    "actorRequirements" TEXT,
    "maleActorsNeeded" INTEGER NOT NULL DEFAULT 0,
    "femaleActorsNeeded" INTEGER NOT NULL DEFAULT 0,
    "written" BOOLEAN NOT NULL DEFAULT false,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Scenario_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Scenario_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Scenario" ("actorRequirements", "cancelled", "id", "name", "orderIndex", "topicId", "workshopId", "written") SELECT "actorRequirements", "cancelled", "id", "name", "orderIndex", "topicId", "workshopId", "written" FROM "Scenario";
DROP TABLE "Scenario";
ALTER TABLE "new_Scenario" RENAME TO "Scenario";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
