-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mobile" TEXT,
    "email" TEXT,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL,
    "inviteToken" TEXT,
    "inviteExpiry" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "sellerId" TEXT,
    "anchorId" TEXT,
    "investorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "users_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "users_anchorId_fkey" FOREIGN KEY ("anchorId") REFERENCES "anchors" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "users_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "investors" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "twoFactorSecret" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mobile" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'LOGIN',
    "expiresAt" DATETIME NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "sellers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "legalName" TEXT NOT NULL,
    "gstin" TEXT NOT NULL,
    "pan" TEXT NOT NULL,
    "bankAccountNo" TEXT NOT NULL,
    "bankIfsc" TEXT NOT NULL,
    "kycStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "enachMandateId" TEXT,
    "enachMandateStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "creditLimit" REAL NOT NULL DEFAULT 0,
    "creditLimitStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "anchors" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "corporateName" TEXT NOT NULL,
    "gstin" TEXT NOT NULL,
    "creditRating" TEXT NOT NULL DEFAULT 'UNRATED',
    "maxExposureLimit" REAL NOT NULL DEFAULT 0,
    "currentExposure" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "investors" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityName" TEXT NOT NULL,
    "investorType" TEXT NOT NULL DEFAULT 'NBFC',
    "escrowBalance" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceNumber" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "invoiceDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATETIME NOT NULL,
    "tenureDays" INTEGER NOT NULL DEFAULT 90,
    "pricingModel" TEXT NOT NULL DEFAULT 'NET_DISBURSED',
    "totalAmount" REAL NOT NULL,
    "marginHoldPct" REAL NOT NULL DEFAULT 15.0,
    "marginHeldAmount" REAL NOT NULL DEFAULT 0,
    "upfrontDisbursedAmount" REAL NOT NULL DEFAULT 0,
    "discountRatePa" REAL NOT NULL DEFAULT 12.0,
    "platformFeePct" REAL NOT NULL DEFAULT 1.0,
    "recourseType" TEXT NOT NULL DEFAULT 'RECOURSE',
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "ewayBillNo" TEXT,
    "poNumber" TEXT,
    "invoiceDocumentUrl" TEXT,
    "invoiceDocumentName" TEXT,
    "irn" TEXT,
    "irnVerified" BOOLEAN NOT NULL DEFAULT false,
    "cersaiSecurityId" TEXT,
    "cersaiStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "noaSentAt" DATETIME,
    "anchorReminderCount" INTEGER NOT NULL DEFAULT 0,
    "lastReminderSentAt" DATETIME,
    "invoiceHash" TEXT NOT NULL,
    "virtualAccountNumber" TEXT,
    "sellerId" TEXT NOT NULL,
    "anchorId" TEXT NOT NULL,
    "anchorConfirmedAt" DATETIME,
    "fundedAt" DATETIME,
    "settledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "invoices_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "invoices_anchorId_fkey" FOREIGN KEY ("anchorId") REFERENCES "anchors" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "funding_bids" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fundedAmount" REAL NOT NULL,
    "expectedReturn" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "invoiceId" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "funding_bids_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "funding_bids_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "investors" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "escrow_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transactionType" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "notes" TEXT,
    "invoiceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "escrow_transactions_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "settlement_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "totalReceived" REAL NOT NULL,
    "investorPrincipalPaid" REAL NOT NULL,
    "investorInterestPaid" REAL NOT NULL,
    "platformFeeDeducted" REAL NOT NULL,
    "sellerMarginReturned" REAL NOT NULL,
    "shortfallAmount" REAL NOT NULL DEFAULT 0,
    "recourseTriggered" BOOLEAN NOT NULL DEFAULT false,
    "invoiceId" TEXT NOT NULL,
    "settledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "settlement_records_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "idempotencyKey" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'ICICI_ESCROW',
    "eventType" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSED',
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "users_mobile_key" ON "users"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_inviteToken_key" ON "users"("inviteToken");

-- CreateIndex
CREATE UNIQUE INDEX "users_sellerId_key" ON "users"("sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "users_anchorId_key" ON "users"("anchorId");

-- CreateIndex
CREATE UNIQUE INDEX "users_investorId_key" ON "users"("investorId");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sellers_gstin_key" ON "sellers"("gstin");

-- CreateIndex
CREATE UNIQUE INDEX "anchors_gstin_key" ON "anchors"("gstin");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceHash_key" ON "invoices"("invoiceHash");

-- CreateIndex
CREATE UNIQUE INDEX "settlement_records_invoiceId_key" ON "settlement_records"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_idempotencyKey_key" ON "webhook_events"("idempotencyKey");
