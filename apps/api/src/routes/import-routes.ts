import type { FastifyInstance } from "fastify";
import {
  deriveFromOpenCertsImportRequestSchema,
  importOpenCertsPendingResponseSchema,
  importOpenCertsRequestSchema
} from "@revealid/contracts";
import type { OpenCertsImportService } from "../imports/opencerts-import-service.js";

export async function registerImportRoutes(
  app: FastifyInstance,
  options: {
    openCertsImportService: OpenCertsImportService;
  }
) {
  app.post(
    "/imports/opencerts",
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
          required: ["fileName", "document"],
          additionalProperties: false,
          properties: {
            fileName: { type: "string", minLength: 1, maxLength: 240 },
            document: { type: "object", additionalProperties: true },
            verificationMode: { type: "string", enum: ["LOCAL_TRUSTVC", "OPENCERTS_API"] },
            issuerPolicyMode: { type: "string", enum: ["DEMO", "NUS_ONLY"] },
            retainEncryptedSource: { type: "boolean" }
          }
        }
      }
    },
    async (request, reply) => {
      const holderId = request.user?.id;
      if (!holderId) {
        return reply.code(401).send({ error: "Unauthenticated" });
      }
      try {
        const response = await options.openCertsImportService.createPendingImport(
          holderId,
          importOpenCertsRequestSchema.parse(request.body)
        );
        return reply.code(202).send(importOpenCertsPendingResponseSchema.parse(response));
      } catch (error) {
        if (error instanceof Error && error.message === "OpenCerts upload too large") {
          return reply.code(413).send({ error: "OpenCerts upload too large" });
        }
        if (
          error instanceof Error &&
          error.message === "OpenCerts source retention is not available in Phase 1"
        ) {
          return reply.code(409).send({ error: "OpenCerts source retention is not available in Phase 1" });
        }
        throw error;
      }
    }
  );

  app.post(
    "/imports/opencerts/:importId/derive",
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
          required: ["importId"],
          properties: { importId: { type: "string", format: "uuid" } }
        },
        body: {
          type: "object",
          required: ["credentialTemplate"],
          additionalProperties: false,
          properties: {
            credentialTemplate: {
              type: "string",
              enum: ["GRADUATION_PROOF", "INSTITUTION_COURSE_PROOF", "CUSTOM"]
            }
          }
        }
      }
    },
    async (request, reply) => {
      deriveFromOpenCertsImportRequestSchema.parse(request.body);
      return reply.code(409).send({
        error: "OpenCerts import derivation starts in Phase 3 after Phase 2 verification is available"
      });
    }
  );
}
