CREATE TABLE "CertificateTemplate" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "academyNameAr" TEXT NOT NULL DEFAULT 'أكاديمية Laxalab',
    "academyNameEn" TEXT NOT NULL DEFAULT 'Laxalab Academy',
    "titleAr" TEXT NOT NULL DEFAULT 'شهادة إتمام الدورة',
    "titleEn" TEXT NOT NULL DEFAULT 'Certificate of Completion',
    "descriptionAr" TEXT NOT NULL DEFAULT 'بما في ذلك جميع المتطلبات الدراسية والتمارين العملية والاختبارات التقييمية اللازمة لإتمام الدورة بنجاح.',
    "descriptionEn" TEXT NOT NULL DEFAULT 'Including all coursework, practical assignments, and assessments required for successful completion.',
    "directorSignatureUrl" TEXT,
    "academyStampUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "CertificateTemplate_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Certificate"
ADD COLUMN "instructorId" TEXT;

CREATE INDEX "Certificate_instructorId_idx" ON "Certificate"("instructorId");

ALTER TABLE "Certificate"
ADD CONSTRAINT "Certificate_instructorId_fkey"
FOREIGN KEY ("instructorId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CertificateInstructorSignature" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "signatureUrl" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "CertificateInstructorSignature_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CertificateInstructorSignature_instructorId_key"
ON "CertificateInstructorSignature"("instructorId");

ALTER TABLE "CertificateInstructorSignature"
ADD CONSTRAINT "CertificateInstructorSignature_instructorId_fkey"
FOREIGN KEY ("instructorId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
