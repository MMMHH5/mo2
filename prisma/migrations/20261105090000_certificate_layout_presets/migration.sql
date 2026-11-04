ALTER TABLE "CertificateTemplate"
ADD COLUMN "designKey" TEXT NOT NULL DEFAULT 'classic',
ADD COLUMN "layout" JSONB NOT NULL DEFAULT '{}';

CREATE TABLE "CertificateTemplatePreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designKey" TEXT NOT NULL DEFAULT 'classic',
    "layout" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "CertificateTemplatePreset_pkey" PRIMARY KEY ("id")
);
