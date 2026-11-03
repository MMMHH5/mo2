ALTER TABLE "Course" ADD COLUMN "archivedAt" TIMESTAMP(3);

ALTER TABLE "CourseOpening" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "Course_archivedAt_idx" ON "Course"("archivedAt");

CREATE INDEX "CourseOpening_archivedAt_idx" ON "CourseOpening"("archivedAt");
