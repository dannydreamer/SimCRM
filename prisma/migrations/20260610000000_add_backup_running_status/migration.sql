-- Add RUNNING value to BackupStatus enum
ALTER TYPE "BackupStatus" ADD VALUE IF NOT EXISTS 'RUNNING';
