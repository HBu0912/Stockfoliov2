-- CreateTable
CREATE TABLE "ArenaStockVote" (
    "id" TEXT NOT NULL,
    "arenaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArenaStockVote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ArenaStockVote_arenaId_userId_symbol_key" ON "ArenaStockVote"("arenaId", "userId", "symbol");

CREATE INDEX "ArenaStockVote_arenaId_symbol_idx" ON "ArenaStockVote"("arenaId", "symbol");

ALTER TABLE "ArenaStockVote" ADD CONSTRAINT "ArenaStockVote_arenaId_fkey" FOREIGN KEY ("arenaId") REFERENCES "Arena"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ArenaStockVote" ADD CONSTRAINT "ArenaStockVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
