ALTER TABLE "Credential" ADD COLUMN "revokedAt" TIMESTAMP(3);

CREATE TABLE "VerificationAudit" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shareId" UUID,
    "credentialId" UUID,
    "tokenHashPrefix" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "failureCode" TEXT,
    "checks" JSONB NOT NULL,
    "requestIpHash" TEXT,
    "userAgentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Credential_revokedAt_idx" ON "Credential"("revokedAt");
CREATE INDEX "VerificationAudit_shareId_createdAt_idx" ON "VerificationAudit"("shareId", "createdAt");
CREATE INDEX "VerificationAudit_credentialId_createdAt_idx" ON "VerificationAudit"("credentialId", "createdAt");
CREATE INDEX "VerificationAudit_result_createdAt_idx" ON "VerificationAudit"("result", "createdAt");

ALTER TABLE "VerificationAudit" ADD CONSTRAINT "VerificationAudit_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "Share"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VerificationAudit" ADD CONSTRAINT "VerificationAudit_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "Credential"("id") ON DELETE SET NULL ON UPDATE CASCADE;
