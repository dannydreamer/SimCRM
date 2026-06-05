-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MANAGER', 'TECH', 'CASTER', 'FEEDBACK_DOCUMENTER', 'FACILITATOR');

-- CreateEnum
CREATE TYPE "ShiyuchPedagogi" AS ENUM ('GIL_HARACH', 'YESODI', 'TICHON', 'CHINUCH_MEYUCHAD', 'SHAFACH', 'MOVILEI_TECHUM', 'IRIYAT_YERUSHALAIM', 'MANCHI', 'ACHER');

-- CreateEnum
CREATE TYPE "ShiyuchTakzivi" AS ENUM ('OVDEI_HORAA', 'MANCHI', 'IRIYAT_YERUSHALAIM_TASHLUM', 'CHUTZNIIOT_TASHLUM');

-- CreateEnum
CREATE TYPE "WorkshopStatus" AS ENUM ('NEW', 'SPECIFIED', 'READY', 'CLOSING', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('CENTER', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "RagColor" AS ENUM ('GREEN', 'YELLOW', 'RED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "BackupType" AS ENUM ('AUTO', 'MANUAL');

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonRole" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "role" "Role" NOT NULL,

    CONSTRAINT "PersonRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "shiyuchPedagogi" "ShiyuchPedagogi" NOT NULL,
    "shiyuchTakzivi" "ShiyuchTakzivi" NOT NULL,
    "pocName" TEXT,
    "pocPhone" TEXT,
    "pocEmail" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParticipantGroup" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "ParticipantGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workshop" (
    "id" TEXT NOT NULL,
    "participantGroupId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "numRooms" INTEGER NOT NULL,
    "locationType" "LocationType" NOT NULL DEFAULT 'CENTER',
    "locationName" TEXT,
    "authorId" TEXT,
    "directorRequested" BOOLEAN NOT NULL DEFAULT false,
    "directorNotes" TEXT,
    "status" "WorkshopStatus" NOT NULL DEFAULT 'NEW',
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "tentative" BOOLEAN NOT NULL DEFAULT false,
    "postponedWarning" BOOLEAN NOT NULL DEFAULT false,
    "roomCancelledWarning" BOOLEAN NOT NULL DEFAULT false,
    "roomAddedWarning" BOOLEAN NOT NULL DEFAULT false,
    "feedbackFormAdded" BOOLEAN NOT NULL DEFAULT false,
    "castingMaleNeeded" INTEGER,
    "castingFemaleNeeded" INTEGER,
    "castingNotes" TEXT,
    "castingSentAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "Workshop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "roomNumber" INTEGER NOT NULL,
    "facilitatorId" TEXT,
    "pptReceived" BOOLEAN NOT NULL DEFAULT false,
    "facilitatorTentative" BOOLEAN NOT NULL DEFAULT false,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "letterReceived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "name" TEXT,
    "topicId" TEXT NOT NULL,
    "actorRequirements" TEXT,
    "maleActorsNeeded" INTEGER NOT NULL DEFAULT 0,
    "femaleActorsNeeded" INTEGER NOT NULL DEFAULT 0,
    "written" BOOLEAN NOT NULL DEFAULT false,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Actor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "languages" TEXT,
    "specialties" TEXT,
    "canDirect" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Actor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Casting" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "scenarioId" TEXT,
    "roomId" TEXT,
    "actorId" TEXT NOT NULL,
    "isDirector" BOOLEAN NOT NULL DEFAULT false,
    "slotGender" TEXT,
    "slotIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Casting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActorWorkshopAvailability" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ActorWorkshopAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopConfirmedActor" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,

    CONSTRAINT "WorkshopConfirmedActor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CastingChangeLog" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CastingChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "roomId" TEXT,
    "aspect1PrepColor" "RagColor" NOT NULL DEFAULT 'GREEN',
    "aspect1PrepText" TEXT,
    "aspect2SimColor" "RagColor" NOT NULL DEFAULT 'GREEN',
    "aspect2SimText" TEXT,
    "aspect3ReflectionColor" "RagColor" NOT NULL DEFAULT 'GREEN',
    "aspect3ReflectionText" TEXT,
    "aspect4ProfessionalColor" "RagColor" NOT NULL DEFAULT 'GREEN',
    "aspect4ProfessionalText" TEXT,
    "enteredById" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActorDevelopmentLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "note" TEXT NOT NULL,
    "enteredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActorDevelopmentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnualGoal" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "shiyuchTakzivi" "ShiyuchTakzivi" NOT NULL,
    "allocation" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AnnualGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackupLog" (
    "id" TEXT NOT NULL,
    "type" "BackupType" NOT NULL,
    "filePath" TEXT,
    "fileSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackupLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Person_email_key" ON "Person"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PersonRole_personId_role_key" ON "PersonRole"("personId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Room_workshopId_roomNumber_key" ON "Room"("workshopId", "roomNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ActorWorkshopAvailability_actorId_workshopId_key" ON "ActorWorkshopAvailability"("actorId", "workshopId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopConfirmedActor_workshopId_gender_slotIndex_key" ON "WorkshopConfirmedActor"("workshopId", "gender", "slotIndex");

-- CreateIndex
CREATE UNIQUE INDEX "AnnualGoal_year_shiyuchTakzivi_key" ON "AnnualGoal"("year", "shiyuchTakzivi");

-- AddForeignKey
ALTER TABLE "PersonRole" ADD CONSTRAINT "PersonRole_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantGroup" ADD CONSTRAINT "ParticipantGroup_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workshop" ADD CONSTRAINT "Workshop_participantGroupId_fkey" FOREIGN KEY ("participantGroupId") REFERENCES "ParticipantGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workshop" ADD CONSTRAINT "Workshop_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workshop" ADD CONSTRAINT "Workshop_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_facilitatorId_fkey" FOREIGN KEY ("facilitatorId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Casting" ADD CONSTRAINT "Casting_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Casting" ADD CONSTRAINT "Casting_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Casting" ADD CONSTRAINT "Casting_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Casting" ADD CONSTRAINT "Casting_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Actor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActorWorkshopAvailability" ADD CONSTRAINT "ActorWorkshopAvailability_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Actor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActorWorkshopAvailability" ADD CONSTRAINT "ActorWorkshopAvailability_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopConfirmedActor" ADD CONSTRAINT "WorkshopConfirmedActor_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopConfirmedActor" ADD CONSTRAINT "WorkshopConfirmedActor_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Actor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CastingChangeLog" ADD CONSTRAINT "CastingChangeLog_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Actor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActorDevelopmentLog" ADD CONSTRAINT "ActorDevelopmentLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Actor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActorDevelopmentLog" ADD CONSTRAINT "ActorDevelopmentLog_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
