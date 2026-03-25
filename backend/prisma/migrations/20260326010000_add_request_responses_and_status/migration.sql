ALTER TABLE "requests"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'OPEN';

CREATE TABLE "request_responses" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_responses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "request_responses_requestId_donorId_key" ON "request_responses"("requestId", "donorId");
CREATE INDEX "request_responses_requestId_idx" ON "request_responses"("requestId");
CREATE INDEX "request_responses_donorId_idx" ON "request_responses"("donorId");

ALTER TABLE "request_responses"
ADD CONSTRAINT "request_responses_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "requests"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "request_responses"
ADD CONSTRAINT "request_responses_donorId_fkey"
FOREIGN KEY ("donorId") REFERENCES "donors"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
