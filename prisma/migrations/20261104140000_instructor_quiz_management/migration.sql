ALTER TABLE "Quiz"
ADD COLUMN "isFinal" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Quiz"
SET "isFinal" = true
WHERE "moduleId" IS NULL;
