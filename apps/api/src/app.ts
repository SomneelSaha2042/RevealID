import fastify from "fastify";
import { randomBytes } from "node:crypto";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { AppConfig } from "./config.js";
import { AuthService } from "./auth/auth-service.js";
import { TokenService } from "./auth/token-service.js";
import { CredentialCryptoService } from "@revealid/crypto";
import { CredentialService } from "./credentials/credential-service.js";
import { CredentialStatusService } from "./credentials/credential-status-service.js";
import { EnvelopeEncryptionService } from "./credentials/envelope-encryption-service.js";
import { KeyManagementService } from "./credentials/key-management-service.js";
import { PresentationService } from "./credentials/presentation-service.js";
import { OpenCertsImportService } from "./imports/opencerts-import-service.js";
import { authPlugin } from "./http/auth-plugin.js";
import { registerAuthRoutes } from "./routes/auth-routes.js";
import { registerCredentialRoutes } from "./routes/credential-routes.js";
import { registerImportRoutes } from "./routes/import-routes.js";
import type { Prisma } from "./db.js";

const getCredentialEncryptionKey = (config: AppConfig) => {
  if (config.CREDENTIAL_ENCRYPTION_KEY) {
    return config.CREDENTIAL_ENCRYPTION_KEY;
  }
  if (config.NODE_ENV === "production") {
    throw new Error("CREDENTIAL_ENCRYPTION_KEY is required in production");
  }
  return randomBytes(32).toString("base64url");
};

const getIssuerPrivateJwk = (config: AppConfig) => {
  if (config.ISSUER_PRIVATE_JWK) {
    return config.ISSUER_PRIVATE_JWK;
  }
  if (config.NODE_ENV === "production") {
    throw new Error("ISSUER_PRIVATE_JWK is required in production");
  }
  return undefined;
};

export async function buildApp(options: { config: AppConfig; prisma: Prisma }) {
  const app = fastify({
    logger: {
      level: options.config.NODE_ENV === "test" ? "silent" : "info",
      redact: {
        paths: [
          "req.headers.cookie",
          "req.headers.authorization",
          "res.headers.set-cookie",
          "*.password",
          "*.accessToken",
          "*.refreshToken"
        ],
        censor: "[redacted]"
      }
    }
  });

  await app.register(helmet);
  await app.register(cors, {
    origin: options.config.WEB_ORIGIN,
    credentials: true
  });
  await app.register(cookie);
  await app.register(rateLimit, {
    global: false
  });
  await app.register(swagger, {
    openapi: {
      info: {
        title: "RevealID API",
        version: "0.1.0"
      }
    }
  });
  await app.register(swaggerUi, {
    routePrefix: "/docs"
  });

  const tokenService = new TokenService(options.config.AUTH_ACCESS_TOKEN_SECRET);
  const envelopeEncryption = new EnvelopeEncryptionService(getCredentialEncryptionKey(options.config));
  const keyManagementService = new KeyManagementService(
    options.prisma,
    envelopeEncryption,
    getIssuerPrivateJwk(options.config)
  );
  const credentialStatusService = new CredentialStatusService(options.prisma);
  const credentialService = new CredentialService(
    options.prisma,
    new CredentialCryptoService(),
    keyManagementService,
    envelopeEncryption,
    options.config.ISSUER_ID,
    options.config.ISSUER_NAME
  );
  const presentationService = new PresentationService(
    options.prisma,
    new CredentialCryptoService(),
    keyManagementService,
    envelopeEncryption,
    credentialStatusService,
    options.config.WEB_ORIGIN
  );
  const openCertsImportService = new OpenCertsImportService(options.prisma as never, {
    defaultVerificationMode: options.config.OPENCERTS_VERIFICATION_MODE,
    defaultIssuerPolicyMode: options.config.OPENCERTS_ISSUER_POLICY_MODE,
    maxUploadBytes: options.config.MAX_OPENCERTS_UPLOAD_BYTES,
    retainSourceByDefault: options.config.OPENCERTS_RETAIN_SOURCE
  });
  const authService = new AuthService(options.prisma, tokenService, keyManagementService);
  await app.register(authPlugin, { prisma: options.prisma, tokenService });
  await registerAuthRoutes(app, { authService, cookieSecure: options.config.COOKIE_SECURE });
  await registerImportRoutes(app, { openCertsImportService });
  await registerCredentialRoutes(app, {
    credentialService,
    presentationService,
    credentialStatusService,
    keyManagementService,
    issuerId: options.config.ISSUER_ID,
    issuerName: options.config.ISSUER_NAME
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.setErrorHandler((error: Error & { code?: string }, _request, reply) => {
    if (error.code === "P2002") {
      return reply.code(409).send({ error: "Email already registered" });
    }
    if (error.message === "Invalid credentials" || error.message === "Invalid refresh token") {
      return reply.code(401).send({ error: "Unauthenticated" });
    }
    if (error.name === "ZodError") {
      return reply.code(400).send({ error: "Invalid request" });
    }
    if (error.message === "Holder not found" || error.message === "Holder key not found") {
      return reply.code(404).send({ error: "Holder not found" });
    }
    if (error.message === "Credential not found" || error.message === "Share not found") {
      return reply.code(404).send({ error: "Not found" });
    }
    if (
      error.message === "Share expired" ||
      error.message === "Share revoked" ||
      error.message === "Share exhausted" ||
      error.message === "Credential revoked" ||
      error.message === "Verification expired" ||
      error.message === "Verification cancelled" ||
      error.message === "Verification exhausted" ||
      error.message === "Verification revoked" ||
      error.message === "Verification tampered"
    ) {
      return reply.code(410).send({ error: error.message });
    }
    app.log.error(error);
    return reply.code(500).send({ error: "Internal server error" });
  });

  return app;
}
