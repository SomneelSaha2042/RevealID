CREATE TYPE "SourceCredentialImportStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'FAILED', 'DERIVED');

CREATE TABLE "SourceCredentialImport" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "holderId" UUID NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceFileHash" TEXT NOT NULL,
    "verificationMode" TEXT NOT NULL,
    "issuerPolicyMode" TEXT NOT NULL,
    "verificationSummary" JSONB,
    "normalizedClaims" JSONB,
    "hiddenByDefault" TEXT[],
    "encryptedSourceDocument" JSONB,
    "sourceRetentionExpiresAt" TIMESTAMP(3),
    "derivedCredentialId" UUID,
    "status" "SourceCredentialImportStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "SourceCredentialImport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SourceCredentialImport_holderId_createdAt_idx" ON "SourceCredentialImport"("holderId", "createdAt");
CREATE INDEX "SourceCredentialImport_sourceFileHash_idx" ON "SourceCredentialImport"("sourceFileHash");
CREATE INDEX "SourceCredentialImport_status_createdAt_idx" ON "SourceCredentialImport"("status", "createdAt");
CREATE INDEX "SourceCredentialImport_derivedCredentialId_idx" ON "SourceCredentialImport"("derivedCredentialId");

ALTER TABLE "SourceCredentialImport" ADD CONSTRAINT "SourceCredentialImport_holderId_fkey" FOREIGN KEY ("holderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SourceCredentialImport" ADD CONSTRAINT "SourceCredentialImport_derivedCredentialId_fkey" FOREIGN KEY ("derivedCredentialId") REFERENCES "Credential"("id") ON DELETE SET NULL ON UPDATE CASCADE;
