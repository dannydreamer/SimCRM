-- CreateTable
CREATE TABLE "WorkshopConfirmedActor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workshopId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    CONSTRAINT "WorkshopConfirmedActor_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkshopConfirmedActor_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Actor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopConfirmedActor_workshopId_gender_slotIndex_key" ON "WorkshopConfirmedActor"("workshopId", "gender", "slotIndex");
