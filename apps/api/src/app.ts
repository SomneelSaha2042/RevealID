import fastify from "fastify";
import { randomBytes } from "node:crypto";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { AppConfig } from "./config.js";
import { AuthService } from "./auth/auth-service.js";
import { TokenService } from "./auth/token-service.js";
import { CredentialCryptoService } from "@revealid/crypto";
import { CredentialService } from "./credentials/credential-service.js";
import { EnvelopeEncryptionService } from "./credentials/envelope-encryption-service.js";
import { KeyManagementService } from "./credentials/key-management-service.js";
import { authPlugin } from "./http/auth-plugin.js";
import { registerAuthRoutes } from "./routes/auth-routes.js";
import { registerCredentialRoutes } from "./routes/credential-routes.js";
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
  const credentialService = new CredentialService(
    options.prisma,
    new CredentialCryptoService(),
    keyManagementService,
    envelopeEncryption,
    options.config.ISSUER_ID,
    options.config.ISSUER_NAME
  );
  const authService = new AuthService(options.prisma, tokenService, keyManagementService);
  await app.register(authPlugin, { prisma: options.prisma, tokenService });
  await registerAuthRoutes(app, { authService, cookieSecure: options.config.COOKIE_SECURE });
  await registerCredentialRoutes(app, {
    credentialService,
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
    app.log.error(error);
    return reply.code(500).send({ error: "Internal server error" });
  });

  return app;
}
