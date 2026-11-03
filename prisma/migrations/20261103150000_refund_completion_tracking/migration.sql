ALTER TYPE "RefundStatus" ADD VALUE 'PROCESSING';

ALTER TABLE "RefundRequest"
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "completedById" TEXT,
  ADD COLUMN "payoutReference" TEXT;

ALTER TABLE "RefundRequest"
  ADD CONSTRAINT "RefundRequest_completedById_fkey"
  FOREIGN KEY ("completedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "RefundRequest_completedById_idx" ON "RefundRequest"("completedById");
