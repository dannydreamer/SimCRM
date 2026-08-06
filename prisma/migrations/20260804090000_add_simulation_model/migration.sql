-- CreateTable
CREATE TABLE "SimulationModel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimulationModel_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Scenario" ADD COLUMN "modelId" TEXT;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "SimulationModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
