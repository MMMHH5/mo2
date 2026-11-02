ALTER TABLE "AuditLog"
    ADD COLUMN "actorEmail" TEXT,
    ADD COLUMN "actorRole" TEXT,
    ADD COLUMN "targetType" TEXT,
    ADD COLUMN "targetId" TEXT,
    ADD COLUMN "targetLabel" TEXT,
    ADD COLUMN "method" TEXT,
    ADD COLUMN "route" TEXT,
    ADD COLUMN "details" JSONB;

CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");
CREATE INDEX "AuditLog_actorRole_timestamp_idx" ON "AuditLog"("actorRole", "timestamp");
CREATE INDEX "AuditLog_targetType_targetId_timestamp_idx" ON "AuditLog"("targetType", "targetId", "timestamp");
