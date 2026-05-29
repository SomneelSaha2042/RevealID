CREATE TABLE "Share" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "holderId" UUID NOT NULL,
    "credentialId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "keyBindingIssuedAt" INTEGER NOT NULL,
    "encryptedPresentation" JSONB NOT NULL,
    "disclosedClaims" TEXT[],
    "privateClaims" TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxViews" INTEGER NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Share_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Share_tokenHash_key" ON "Share"("tokenHash");
CREATE INDEX "Share_holderId_createdAt_idx" ON "Share"("holderId", "createdAt");
CREATE INDEX "Share_credentialId_idx" ON "Share"("credentialId");
CREATE INDEX "Share_expiresAt_idx" ON "Share"("expiresAt");

ALTER TABLE "Share" ADD CONSTRAINT "Share_holderId_fkey" FOREIGN KEY ("holderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Share" ADD CONSTRAINT "Share_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "Credential"("id") ON DELETE CASCADE ON UPDATE CASCADE;
