-- Facilitator deck files — spec §14 F-06
--
-- The facilitator's template and the decks generated from it. Bytes are stored
-- in chunks of a few MB, because a Vercel function accepts and returns at most
-- 4.5 MB. Two new tables, no change to any existing one.

-- CreateTable
CREATE TABLE "DeckFile" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "workshopId" TEXT,
    "fileName" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "chunkCount" INTEGER NOT NULL,
    "complete" BOOLEAN NOT NULL DEFAULT false,
    "sharedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeckFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeckFileChunk" (
    "fileId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "DeckFileChunk_pkey" PRIMARY KEY ("fileId","index")
);

-- CreateIndex
CREATE INDEX "DeckFile_ownerId_kind_idx" ON "DeckFile"("ownerId", "kind");

-- CreateIndex
CREATE INDEX "DeckFile_workshopId_idx" ON "DeckFile"("workshopId");

-- AddForeignKey
ALTER TABLE "DeckFile" ADD CONSTRAINT "DeckFile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckFile" ADD CONSTRAINT "DeckFile_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckFileChunk" ADD CONSTRAINT "DeckFileChunk_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "DeckFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Every table Prisma creates inherits full anon/authenticated privileges from
-- Supabase's default privileges (spec §2.3.1). The disabled Data API keeps
-- them unreachable; these two hold files, so revoke them here as well.
REVOKE ALL ON TABLE "DeckFile", "DeckFileChunk" FROM anon, authenticated;
