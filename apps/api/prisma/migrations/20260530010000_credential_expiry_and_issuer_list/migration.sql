ALTER TABLE "Credential" ADD COLUMN "expiresAt" TIMESTAMP(3);

UPDATE "Credential" SET "expiresAt" = "issuedAt" + INTERVAL '5 years' WHERE "expiresAt" IS NULL;

CREATE INDEX "Credential_expiresAt_idx" ON "Credential"("expiresAt");
