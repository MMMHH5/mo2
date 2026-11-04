ALTER TABLE "Chapter"
ADD COLUMN "openingId" TEXT;

ALTER TABLE "Module"
ADD COLUMN "openingId" TEXT;

ALTER TABLE "Quiz"
ADD COLUMN "openingId" TEXT;

CREATE TABLE "OpeningModuleContent" (
    "id" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "openingId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,

    CONSTRAINT "OpeningModuleContent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OpeningModuleContent_openingId_moduleId_key"
ON "OpeningModuleContent"("openingId", "moduleId");
CREATE INDEX "OpeningModuleContent_openingId_idx"
ON "OpeningModuleContent"("openingId");
CREATE INDEX "Chapter_openingId_idx" ON "Chapter"("openingId");
CREATE INDEX "Module_openingId_idx" ON "Module"("openingId");
CREATE INDEX "Quiz_openingId_idx" ON "Quiz"("openingId");
CREATE UNIQUE INDEX "Quiz_one_final_per_opening_key"
ON "Quiz"("openingId")
WHERE "openingId" IS NOT NULL AND "isFinal" = true;

ALTER TABLE "Chapter"
ADD CONSTRAINT "Chapter_openingId_fkey"
FOREIGN KEY ("openingId") REFERENCES "CourseOpening"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Module"
ADD CONSTRAINT "Module_openingId_fkey"
FOREIGN KEY ("openingId") REFERENCES "CourseOpening"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Quiz"
ADD CONSTRAINT "Quiz_openingId_fkey"
FOREIGN KEY ("openingId") REFERENCES "CourseOpening"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OpeningModuleContent"
ADD CONSTRAINT "OpeningModuleContent_openingId_fkey"
FOREIGN KEY ("openingId") REFERENCES "CourseOpening"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OpeningModuleContent"
ADD CONSTRAINT "OpeningModuleContent_moduleId_fkey"
FOREIGN KEY ("moduleId") REFERENCES "Module"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
