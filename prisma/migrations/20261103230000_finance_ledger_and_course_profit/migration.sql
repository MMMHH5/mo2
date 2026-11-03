CREATE TYPE "FinanceExpenseStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAID', 'REJECTED');
CREATE TYPE "FinanceExpenseType" AS ENUM ('OPERATING', 'INSTRUCTOR_PAYOUT');
CREATE TYPE "FinanceExpenseCategory" AS ENUM ('MARKETING', 'PLATFORM', 'SALARIES', 'MATERIALS', 'TRAVEL', 'OFFICE', 'OTHER');

ALTER TABLE "CourseOpening"
ADD COLUMN "instructorSharePercent" DECIMAL(5,2);

CREATE TABLE "FinanceExpense" (
    "id" TEXT NOT NULL,
    "type" "FinanceExpenseType" NOT NULL DEFAULT 'OPERATING',
    "category" "FinanceExpenseCategory" NOT NULL DEFAULT 'OTHER',
    "status" "FinanceExpenseStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "vendor" TEXT,
    "notes" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "paymentReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "openingId" TEXT,
    "instructorId" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "paidById" TEXT,

    CONSTRAINT "FinanceExpense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinanceExpense_status_createdAt_idx" ON "FinanceExpense"("status", "createdAt");
CREATE INDEX "FinanceExpense_openingId_currency_status_idx" ON "FinanceExpense"("openingId", "currency", "status");
CREATE INDEX "FinanceExpense_instructorId_status_idx" ON "FinanceExpense"("instructorId", "status");

ALTER TABLE "FinanceExpense" ADD CONSTRAINT "FinanceExpense_openingId_fkey"
FOREIGN KEY ("openingId") REFERENCES "CourseOpening"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinanceExpense" ADD CONSTRAINT "FinanceExpense_instructorId_fkey"
FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinanceExpense" ADD CONSTRAINT "FinanceExpense_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinanceExpense" ADD CONSTRAINT "FinanceExpense_approvedById_fkey"
FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinanceExpense" ADD CONSTRAINT "FinanceExpense_paidById_fkey"
FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
