ALTER TABLE "donors"
ADD COLUMN "passwordHash" TEXT,
ADD COLUMN "gender" TEXT,
ADD COLUMN "dateOfBirth" TIMESTAMP(3),
ADD COLUMN "profileImage" TEXT,
ADD COLUMN "canDonate" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "requests"
ADD COLUMN "area" TEXT,
ADD COLUMN "hospital" TEXT,
ADD COLUMN "createdById" TEXT;

ALTER TABLE "requests"
ALTER COLUMN "donorId" DROP NOT NULL;

CREATE INDEX "requests_createdById_idx" ON "requests"("createdById");

ALTER TABLE "requests"
DROP CONSTRAINT "requests_donorId_fkey";

ALTER TABLE "requests"
ADD CONSTRAINT "requests_donorId_fkey"
FOREIGN KEY ("donorId") REFERENCES "donors"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "requests"
ADD CONSTRAINT "requests_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "donors"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
