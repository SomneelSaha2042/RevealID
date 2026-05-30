import type { FastifyInstance } from "fastify";
import {
  createShareRequestSchema,
  createShareResponseSchema,
  credentialDetailResponseSchema,
  issueCredentialRequestSchema,
  issuerCredentialListResponseSchema,
  shareHistoryResponseSchema,
  verifyCredentialRequestSchema,
  verifyCredentialResponseSchema,
  verifyShareResponseSchema,
  walletCredentialListResponseSchema
} from "@revealid/contracts";
import type { CredentialService } from "../credentials/credential-service.js";
import type { CredentialStatusService } from "../credentials/credential-status-service.js";
import type { KeyManagementService } from "../credentials/key-management-service.js";
import type { PresentationService } from "../credentials/presentation-service.js";

export async function registerCredentialRoutes(
  app: FastifyInstance,
  options: {
    credentialService: CredentialService;
    presentationService: PresentationService;
    credentialStatusService: CredentialStatusService;
    keyManagementService: KeyManagementService;
    issuerId: string;
    issuerName: string;
  }
) {
  app.get(
    "/.well-known/jwks.json",
    {
      schema: {
        response: {
          200: {
            type: "object",
            required: ["keys"],
            properties: {
              keys: {
                type: "array",
                items: {
                  type: "object",
                  required: ["kty", "crv", "x", "kid", "alg", "use"],
                  properties: {
                    kty: { type: "string" },
                    crv: { type: "string" },
                    x: { type: "string" },
                    kid: { type: "string" },
                    alg: { type: "string" },
                    use: { type: "string" }
                  },
                  additionalProperties: false
                }
              }
            }
          }
        }
      }
    },
    async () => options.keyManagementService.getIssuerJwks()
  );

  app.get(
    "/issuer/metadata",
    {
      schema: {
        response: {
          200: {
            type: "object",
            required: ["issuer", "name", "jwksUri", "credentialTypes"],
            properties: {
              issuer: { type: "string", format: "uri" },
              name: { type: "string" },
              jwksUri: { type: "string", format: "uri" },
              credentialTypes: { type: "array", items: { type: "string" } }
            }
          }
        }
      }
    },
    async () => ({
      issuer: options.issuerId,
      name: options.issuerName,
      jwksUri: new URL("/.well-known/jwks.json", options.issuerId).toString(),
      credentialTypes: ["RevealIDAcademicCredential"]
    })
  );

  app.post(
    "/credentials/issue",
    {
      preHandler: async (request, reply) => {
        await app.requireCsrf(request, reply);
        if (reply.sent) return;
        if (request.user?.role !== "ISSUER") {
          return reply.code(403).send({ error: "Issuer role required" });
        }
      },
      schema: {
        body: {
          type: "object",
          required: ["holderEmail", "degree", "graduationYear", "cgpa", "marks"],
          properties: {
            holderEmail: { type: "string", format: "email" },
            degree: { type: "string", minLength: 1, maxLength: 160 },
            graduationYear: { type: "integer", minimum: 1900, maximum: 2200 },
            cgpa: { type: "number", minimum: 0, maximum: 5 },
            marks: { type: "integer", minimum: 0, maximum: 10000 }
          }
        }
      }
    },
    async (request, reply) => {
      const input = issueCredentialRequestSchema.parse(request.body);
      const issuerId = request.user?.id;
      if (!issuerId) {
        return reply.code(401).send({ error: "Unauthenticated" });
      }
      const credential = await options.credentialService.issueCredential(issuerId, input);
      return reply.code(201).send({ credential });
    }
  );

  app.get(
    "/issuer/credentials",
    {
      preHandler: app.requireIssuer,
      schema: {
        response: {
          200: {
            type: "object",
            required: ["credentials"],
            properties: {
              credentials: {
                type: "array",
                items: {
                  type: "object",
                  required: ["id", "holderEmail", "credentialType", "issuerName", "issuedAt", "expiresAt", "revokedAt"],
                  properties: {
                    id: { type: "string", format: "uuid" },
                    holderEmail: { type: "string", format: "email" },
                    credentialType: { type: "string" },
                    issuerName: { type: "string" },
                    issuedAt: { type: "string", format: "date-time" },
                    expiresAt: { anyOf: [{ type: "string", format: "date-time" }, { type: "null" }] },
                    revokedAt: { anyOf: [{ type: "string", format: "date-time" }, { type: "null" }] }
                  }
                }
              }
            }
          }
        }
      }
    },
    async (request) => {
      const issuerId = request.user?.id;
      if (!issuerId) {
        throw new Error("Unauthenticated");
      }
      return issuerCredentialListResponseSchema.parse({
        credentials: await options.credentialService.listIssuerCredentials(issuerId)
      });
    }
  );

  app.get(
    "/wallet/credentials",
    {
      preHandler: app.authenticate,
      schema: {
        response: {
          200: {
            type: "object",
            required: ["credentials"],
            properties: {
              credentials: {
                type: "array",
                items: {
                  type: "object",
                  required: ["id", "credentialType", "issuerName", "issuedAt", "expiresAt", "revokedAt"],
                  properties: {
                    id: { type: "string", format: "uuid" },
                    credentialType: { type: "string" },
                    issuerName: { type: "string" },
                    issuedAt: { type: "string", format: "date-time" },
                    expiresAt: { anyOf: [{ type: "string", format: "date-time" }, { type: "null" }] },
                    revokedAt: { anyOf: [{ type: "string", format: "date-time" }, { type: "null" }] }
                  }
                }
              }
            }
          }
        }
      }
    },
    async (request) => {
      const holderId = request.user?.id;
      if (!holderId) {
        throw new Error("Unauthenticated");
      }
      return walletCredentialListResponseSchema.parse({
        credentials: await options.credentialService.listWalletCredentials(holderId)
      });
    }
  );

  app.get(
    "/wallet/credentials/:id",
    {
      preHandler: app.authenticate,
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } }
        }
      }
    },
    async (request) => {
      const holderId = request.user?.id;
      if (!holderId) {
        throw new Error("Unauthenticated");
      }
      const params = request.params as { id: string };
      return credentialDetailResponseSchema.parse({
        credential: await options.credentialService.getHolderCredentialDetail(holderId, params.id)
      });
    }
  );

  app.post(
    "/credentials/:id/revoke",
    {
      preHandler: async (request, reply) => {
        await app.requireCsrf(request, reply);
        if (reply.sent) return;
        if (request.user?.role !== "ISSUER") {
          return reply.code(403).send({ error: "Issuer role required" });
        }
      },
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } }
        },
        response: {
          200: {
            type: "object",
            required: ["credential"],
            properties: {
              credential: {
                type: "object",
                required: ["id", "revokedAt"],
                properties: {
                  id: { type: "string", format: "uuid" },
                  revokedAt: { type: "string", format: "date-time" }
                }
              }
            }
          },
          401: {
            type: "object",
            required: ["error"],
            properties: { error: { type: "string" } }
          },
          403: {
            type: "object",
            required: ["error"],
            properties: { error: { type: "string" } }
          }
        }
      }
    },
    async (request, reply) => {
      const issuerId = request.user?.id;
      if (!issuerId) {
        return reply.code(401).send({ error: "Unauthenticated" });
      }
      const params = request.params as { id: string };
      const credential = await options.credentialStatusService.revokeCredential(issuerId, params.id);
      return { credential };
    }
  );

  app.post(
    "/credentials/share",
    {
      preHandler: async (request, reply) => {
        await app.requireCsrf(request, reply);
        if (reply.sent) return;
        if (request.user?.role !== "HOLDER") {
          return reply.code(403).send({ error: "Holder role required" });
        }
      },
      schema: {
        body: {
          type: "object",
          required: ["credentialId", "claims", "ttlMinutes", "maxViews"],
          properties: {
            credentialId: { type: "string", format: "uuid" },
            claims: {
              type: "array",
              minItems: 1,
              items: { type: "string", enum: ["degree", "graduationYear", "cgpa", "marks"] }
            },
            audience: { type: "string", minLength: 1, maxLength: 240 },
            ttlMinutes: { type: "integer", minimum: 5, maximum: 43200 },
            maxViews: { type: "integer", minimum: 1, maximum: 100 }
          }
        }
      }
    },
    async (request, reply) => {
      const holderId = request.user?.id;
      if (!holderId) {
        return reply.code(401).send({ error: "Unauthenticated" });
      }
      const share = await options.presentationService.createShare(
        holderId,
        createShareRequestSchema.parse(request.body)
      );
      return reply.code(201).send(createShareResponseSchema.parse({ share }));
    }
  );

  app.get(
    "/shares",
    {
      preHandler: app.authenticate
    },
    async (request) => {
      const holderId = request.user?.id;
      if (!holderId) {
        throw new Error("Unauthenticated");
      }
      return shareHistoryResponseSchema.parse({
        shares: await options.presentationService.listShares(holderId)
      });
    }
  );

  app.delete(
    "/shares/:id",
    {
      preHandler: async (request, reply) => {
        await app.requireCsrf(request, reply);
        if (reply.sent) return;
        if (request.user?.role !== "HOLDER") {
          return reply.code(403).send({ error: "Holder role required" });
        }
      },
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } }
        }
      }
    },
    async (request, reply) => {
      const holderId = request.user?.id;
      if (!holderId) {
        return reply.code(401).send({ error: "Unauthenticated" });
      }
      const params = request.params as { id: string };
      await options.presentationService.cancelShare(holderId, params.id);
      return reply.code(204).send();
    }
  );

  const verificationAttempts = new Map<string, { count: number; resetAt: number }>();
  const verifyRateLimit = () => {
    const now = Date.now();
    const key = "public-credential-verify";
    const current = verificationAttempts.get(key);
    if (!current || current.resetAt <= now) {
      verificationAttempts.set(key, { count: 1, resetAt: now + 60_000 });
      return { allowed: true, retryAfterSeconds: 60 };
    }
    current.count += 1;
    return {
      allowed: current.count <= 20,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    };
  };

  app.post(
    "/credentials/verify",
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: "1 minute"
        }
      },
      preHandler: async (request, reply) => {
        const rateLimitResult = verifyRateLimit();
        if (!rateLimitResult.allowed) {
          return reply
            .code(429)
            .header("retry-after", String(rateLimitResult.retryAfterSeconds))
            .send({ error: "Rate limit exceeded" });
        }
      },
      schema: {
        body: {
          type: "object",
          required: ["token"],
          additionalProperties: false,
          properties: {
            token: { type: "string", minLength: 1, maxLength: 512 }
          }
        }
      }
    },
    async (request) => {
      const body = verifyCredentialRequestSchema.parse(request.body);
      return verifyCredentialResponseSchema.parse(
        await options.presentationService.verifyCredential(body.token, {
          ip: request.ip,
          userAgent:
            typeof request.headers["user-agent"] === "string" ? request.headers["user-agent"] : undefined
        })
      );
    }
  );

  app.get(
    "/shares/verify/:token",
    {
      schema: {
        params: {
          type: "object",
          required: ["token"],
          properties: { token: { type: "string", minLength: 32 } }
        }
      }
    },
    async (request) => {
      const params = request.params as { token: string };
      return verifyShareResponseSchema.parse(await options.presentationService.verifyShare(params.token));
    }
  );
}
