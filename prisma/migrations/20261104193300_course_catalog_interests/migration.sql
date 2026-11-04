CREATE TYPE "CourseInterestStatus" AS ENUM ('PENDING', 'CONTACTED');

CREATE TABLE "CourseInterest" (
    "id" TEXT NOT NULL,
    "contactMethod" "ContactMethod" NOT NULL,
    "contactValue" TEXT NOT NULL,
    "status" "CourseInterestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "courseId" TEXT NOT NULL,

    CONSTRAINT "CourseInterest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CourseInterest_courseId_contactMethod_contactValue_key"
    ON "CourseInterest"("courseId", "contactMethod", "contactValue");
CREATE INDEX "CourseInterest_status_createdAt_idx"
    ON "CourseInterest"("status", "createdAt");
CREATE INDEX "CourseInterest_courseId_createdAt_idx"
    ON "CourseInterest"("courseId", "createdAt");

ALTER TABLE "CourseInterest"
    ADD CONSTRAINT "CourseInterest_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
