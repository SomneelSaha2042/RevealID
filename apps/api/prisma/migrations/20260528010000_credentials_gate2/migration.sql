CREATE TABLE "HolderKey" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "publicJwk" JSONB NOT NULL,
  "encryptedPrivateJwk" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HolderKey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Credential" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "holderId" UUID NOT NULL,
  "issuerId" UUID NOT NULL,
  "credentialType" TEXT NOT NULL,
  "issuerName" TEXT NOT NULL,
  "encryptedSdJwt" JSONB NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Credential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HolderKey_userId_key" ON "HolderKey"("userId");
CREATE INDEX "Credential_holderId_issuedAt_idx" ON "Credential"("holderId", "issuedAt");
CREATE INDEX "Credential_issuerId_idx" ON "Credential"("issuerId");

ALTER TABLE "HolderKey"
ADD CONSTRAINT "HolderKey_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Credential"
ADD CONSTRAINT "Credential_holderId_fkey"
FOREIGN KEY ("holderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Credential"
ADD CONSTRAINT "Credential_issuerId_fkey"
FOREIGN KEY ("issuerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
