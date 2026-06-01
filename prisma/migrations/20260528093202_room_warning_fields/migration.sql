-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Workshop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "participantGroupId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "numRooms" INTEGER NOT NULL,
    "locationType" TEXT NOT NULL DEFAULT 'CENTER',
    "locationName" TEXT,
    "authorId" TEXT,
    "directorRequested" BOOLEAN NOT NULL DEFAULT false,
    "directorNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "tentative" BOOLEAN NOT NULL DEFAULT false,
    "postponedWarning" BOOLEAN NOT NULL DEFAULT false,
    "roomCancelledWarning" BOOLEAN NOT NULL DEFAULT false,
    "roomAddedWarning" BOOLEAN NOT NULL DEFAULT false,
    "feedbackFormAdded" BOOLEAN NOT NULL DEFAULT false,
    "castingMaleNeeded" INTEGER,
    "castingFemaleNeeded" INTEGER,
    "castingNotes" TEXT,
    "castingSentAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    CONSTRAINT "Workshop_participantGroupId_fkey" FOREIGN KEY ("participantGroupId") REFERENCES "ParticipantGroup" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Workshop_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Workshop_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Workshop" ("authorId", "cancelled", "castingFemaleNeeded", "castingMaleNeeded", "castingNotes", "castingSentAt", "createdAt", "createdById", "date", "directorNotes", "directorRequested", "endTime", "feedbackFormAdded", "id", "locationName", "locationType", "notes", "numRooms", "participantGroupId", "postponedWarning", "startTime", "status", "tentative") SELECT "authorId", "cancelled", "castingFemaleNeeded", "castingMaleNeeded", "castingNotes", "castingSentAt", "createdAt", "createdById", "date", "directorNotes", "directorRequested", "endTime", "feedbackFormAdded", "id", "locationName", "locationType", "notes", "numRooms", "participantGroupId", "postponedWarning", "startTime", "status", "tentative" FROM "Workshop";
DROP TABLE "Workshop";
ALTER TABLE "new_Workshop" RENAME TO "Workshop";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
