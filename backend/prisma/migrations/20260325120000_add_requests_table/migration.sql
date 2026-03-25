-- CreateTable
CREATE TABLE "requests" (
    "id" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "requesterPhone" TEXT NOT NULL,
    "bloodGroup" TEXT NOT NULL,
    "message" TEXT,
    "donorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "requests_donorId_idx" ON "requests"("donorId");

-- CreateIndex
CREATE INDEX "requests_requesterPhone_idx" ON "requests"("requesterPhone");

-- CreateIndex
CREATE INDEX "requests_donorId_requesterPhone_createdAt_idx" ON "requests"("donorId", "requesterPhone", "createdAt");

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "donors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
