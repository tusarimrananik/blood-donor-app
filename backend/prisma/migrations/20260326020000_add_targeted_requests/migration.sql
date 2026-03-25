ALTER TABLE "requests"
ADD COLUMN "targetDonorId" TEXT;

CREATE INDEX "requests_targetDonorId_idx" ON "requests"("targetDonorId");

ALTER TABLE "requests"
ADD CONSTRAINT "requests_targetDonorId_fkey"
FOREIGN KEY ("targetDonorId") REFERENCES "donors"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
