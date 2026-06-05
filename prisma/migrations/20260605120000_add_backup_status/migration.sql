-- CreateEnum
CREATE TYPE "BackupStatus" AS ENUM ('SUCCESS', 'FAILED');

-- AlterTable
ALTER TABLE "BackupLog" ADD COLUMN "status" "BackupStatus" NOT NULL DEFAULT 'SUCCESS';
ALTER TABLE "BackupLog" ADD COLUMN "errorMsg" TEXT;
