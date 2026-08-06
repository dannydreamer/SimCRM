-- CreateEnum
CREATE TYPE "RoomLocation" AS ENUM ('ROOM_1', 'ROOM_2', 'ROOM_3', 'OTHER');

-- AlterTable
ALTER TABLE "Workshop" ADD COLUMN "estimatedParticipants" INTEGER;
ALTER TABLE "Workshop" ADD COLUMN "otherRoomNotes" TEXT;
ALTER TABLE "Workshop" ADD COLUMN "otherRoomApproved" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "WorkshopRoomLocation" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "location" "RoomLocation" NOT NULL,

    CONSTRAINT "WorkshopRoomLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopRoomLocation_workshopId_location_key" ON "WorkshopRoomLocation"("workshopId", "location");

-- AddForeignKey
ALTER TABLE "WorkshopRoomLocation" ADD CONSTRAINT "WorkshopRoomLocation_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
