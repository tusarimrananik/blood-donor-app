ALTER TABLE "donors"
ALTER COLUMN "lastDonated" DROP NOT NULL;

CREATE TABLE "notifications" (
  "id" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "actorId" TEXT,
  "requestId" TEXT,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "push_tokens" (
  "id" TEXT NOT NULL,
  "donorId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "disabledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "push_tokens_token_key" ON "push_tokens"("token");
CREATE INDEX "notifications_recipientId_createdAt_idx" ON "notifications"("recipientId", "createdAt");
CREATE INDEX "notifications_recipientId_readAt_idx" ON "notifications"("recipientId", "readAt");
CREATE INDEX "notifications_requestId_idx" ON "notifications"("requestId");
CREATE INDEX "push_tokens_donorId_disabledAt_idx" ON "push_tokens"("donorId", "disabledAt");

ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_recipientId_fkey"
FOREIGN KEY ("recipientId") REFERENCES "donors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "donors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "push_tokens"
ADD CONSTRAINT "push_tokens_donorId_fkey"
FOREIGN KEY ("donorId") REFERENCES "donors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
