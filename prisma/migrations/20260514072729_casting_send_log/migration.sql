-- AlterTable
ALTER TABLE "Workshop" ADD COLUMN "castingSentAt" DATETIME;

-- CreateTable
CREATE TABLE "CastingChangeLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workshopId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CastingChangeLog_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
