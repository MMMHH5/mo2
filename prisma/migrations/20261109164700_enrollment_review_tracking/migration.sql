ALTER TABLE "Enrollment"
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedById" TEXT;

CREATE INDEX "Enrollment_reviewedById_idx" ON "Enrollment"("reviewedById");

ALTER TABLE "Enrollment"
  ADD CONSTRAINT "Enrollment_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

WITH previous_reviews AS (
  SELECT DISTINCT ON (substring("action" FROM '^Finance reviewed Enrollment ([^ ]+)'))
    substring("action" FROM '^Finance reviewed Enrollment ([^ ]+)') AS "enrollmentId",
    substring("action" FROM '^Finance reviewed Enrollment [^ ]+ with status (APPROVED|REJECTED)$') AS "status",
    "userId",
    "timestamp"
  FROM "AuditLog"
  WHERE "action" ~ '^Finance reviewed Enrollment [^ ]+ with status (APPROVED|REJECTED)$'
    AND "userId" IS NOT NULL
  ORDER BY substring("action" FROM '^Finance reviewed Enrollment ([^ ]+)'), "timestamp" DESC
)
UPDATE "Enrollment" AS enrollment
SET "reviewedById" = previous_reviews."userId",
    "reviewedAt" = previous_reviews."timestamp"
FROM previous_reviews
WHERE previous_reviews."enrollmentId" = enrollment."id"
  AND previous_reviews."status" = enrollment."status"::TEXT
  AND enrollment."status" IN ('APPROVED', 'REJECTED');
