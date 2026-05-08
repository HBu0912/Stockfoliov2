-- Persist quarterly trend payloads per symbol for historical merge / future earnings.
CREATE TABLE "TrendsQuarterSnapshot" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "atMs" BIGINT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrendsQuarterSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrendsQuarterSnapshot_symbol_atMs_key" ON "TrendsQuarterSnapshot"("symbol", "atMs");
CREATE INDEX "TrendsQuarterSnapshot_symbol_idx" ON "TrendsQuarterSnapshot"("symbol");
