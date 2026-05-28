import type { FastifyInstance } from "fastify";
import {
  issueCredentialRequestSchema,
  walletCredentialListResponseSchema
} from "@revealid/contracts";
import type { CredentialService } from "../credentials/credential-service.js";
import type { KeyManagementService } from "../credentials/key-management-service.js";

export async function registerCredentialRoutes(
  app: FastifyInstance,
  options: {
    credentialService: CredentialService;
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
                  required: ["id", "credentialType", "issuerName", "issuedAt"],
                  properties: {
                    id: { type: "string", format: "uuid" },
                    credentialType: { type: "string" },
                    issuerName: { type: "string" },
                    issuedAt: { type: "string", format: "date-time" }
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
}
