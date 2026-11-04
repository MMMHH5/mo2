CREATE TABLE "CourseEvaluation" (
    "id" TEXT NOT NULL,
    "courseRating" INTEGER NOT NULL,
    "instructorRating" INTEGER NOT NULL,
    "commentAr" TEXT,
    "commentEn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enrollmentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "openingId" TEXT,
    "instructorId" TEXT NOT NULL,

    CONSTRAINT "CourseEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CourseEvaluation_enrollmentId_key"
ON "CourseEvaluation"("enrollmentId");
CREATE INDEX "CourseEvaluation_openingId_createdAt_idx"
ON "CourseEvaluation"("openingId", "createdAt");
CREATE INDEX "CourseEvaluation_courseId_createdAt_idx"
ON "CourseEvaluation"("courseId", "createdAt");
CREATE INDEX "CourseEvaluation_instructorId_createdAt_idx"
ON "CourseEvaluation"("instructorId", "createdAt");

ALTER TABLE "CourseEvaluation"
ADD CONSTRAINT "CourseEvaluation_enrollmentId_fkey"
FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CourseEvaluation"
ADD CONSTRAINT "CourseEvaluation_courseId_fkey"
FOREIGN KEY ("courseId") REFERENCES "Course"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CourseEvaluation"
ADD CONSTRAINT "CourseEvaluation_openingId_fkey"
FOREIGN KEY ("openingId") REFERENCES "CourseOpening"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CourseEvaluation"
ADD CONSTRAINT "CourseEvaluation_instructorId_fkey"
FOREIGN KEY ("instructorId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
