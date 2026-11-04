CREATE TABLE "HomepageSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "draft" JSONB NOT NULL,
    "published" JSONB,
    "updatedById" TEXT,
    "publishedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "HomepageSettings_pkey" PRIMARY KEY ("id")
);
