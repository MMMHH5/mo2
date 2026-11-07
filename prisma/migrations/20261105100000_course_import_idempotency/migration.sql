CREATE TABLE "CourseImportRequest" (
    "idempotencyKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseImportRequest_pkey" PRIMARY KEY ("idempotencyKey"),
    CONSTRAINT "CourseImportRequest_courseId_key" UNIQUE ("courseId"),
    CONSTRAINT "CourseImportRequest_courseId_fkey"
        FOREIGN KEY ("courseId") REFERENCES "Course"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);
