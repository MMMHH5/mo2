CREATE TYPE "StudentMessageRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "Message"
ADD COLUMN "openingId" TEXT;

CREATE INDEX "Message_openingId_idx" ON "Message"("openingId");

ALTER TABLE "Message"
ADD CONSTRAINT "Message_openingId_fkey"
FOREIGN KEY ("openingId") REFERENCES "CourseOpening"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "StudentMessageRequest" (
    "id" TEXT NOT NULL,
    "status" "StudentMessageRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "requesterId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "openingId" TEXT NOT NULL,

    CONSTRAINT "StudentMessageRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudentMessageRequest_openingId_requesterId_recipientId_key"
ON "StudentMessageRequest"("openingId", "requesterId", "recipientId");
CREATE INDEX "StudentMessageRequest_recipientId_status_idx"
ON "StudentMessageRequest"("recipientId", "status");
CREATE INDEX "StudentMessageRequest_requesterId_status_idx"
ON "StudentMessageRequest"("requesterId", "status");

ALTER TABLE "StudentMessageRequest"
ADD CONSTRAINT "StudentMessageRequest_requesterId_fkey"
FOREIGN KEY ("requesterId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentMessageRequest"
ADD CONSTRAINT "StudentMessageRequest_recipientId_fkey"
FOREIGN KEY ("recipientId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentMessageRequest"
ADD CONSTRAINT "StudentMessageRequest_openingId_fkey"
FOREIGN KEY ("openingId") REFERENCES "CourseOpening"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
