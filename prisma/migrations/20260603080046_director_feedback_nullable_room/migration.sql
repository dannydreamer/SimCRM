-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Feedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "roomId" TEXT,
    "aspect1PrepColor" TEXT NOT NULL DEFAULT 'GREEN',
    "aspect1PrepText" TEXT,
    "aspect2SimColor" TEXT NOT NULL DEFAULT 'GREEN',
    "aspect2SimText" TEXT,
    "aspect3ReflectionColor" TEXT NOT NULL DEFAULT 'GREEN',
    "aspect3ReflectionText" TEXT,
    "aspect4ProfessionalColor" TEXT NOT NULL DEFAULT 'GREEN',
    "aspect4ProfessionalText" TEXT,
    "enteredById" TEXT NOT NULL,
    "enteredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Feedback_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Actor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Feedback_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Feedback_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Feedback_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Feedback" ("actorId", "aspect1PrepColor", "aspect1PrepText", "aspect2SimColor", "aspect2SimText", "aspect3ReflectionColor", "aspect3ReflectionText", "aspect4ProfessionalColor", "aspect4ProfessionalText", "enteredAt", "enteredById", "id", "roomId", "workshopId") SELECT "actorId", "aspect1PrepColor", "aspect1PrepText", "aspect2SimColor", "aspect2SimText", "aspect3ReflectionColor", "aspect3ReflectionText", "aspect4ProfessionalColor", "aspect4ProfessionalText", "enteredAt", "enteredById", "id", "roomId", "workshopId" FROM "Feedback";
DROP TABLE "Feedback";
ALTER TABLE "new_Feedback" RENAME TO "Feedback";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
