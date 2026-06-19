import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  deriveFromOpenCertsImportRequestSchema,
  deriveFromOpenCertsImportResponseSchema,
  importOpenCertsFailureResponseSchema,
  importOpenCertsResponseSchema,
  importOpenCertsRequestSchema
} from "@revealid/contracts";
import {
  OpenCertsDerivationError,
  OpenCertsImportError,
  type OpenCertsImportService
} from "../imports/opencerts-import-service.js";

const deriveParamsSchema = z.object({
  importId: z.string().uuid()
});

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
            issuerPolicyMode: { type: "string", enum: ["DEMO", "INSTITUTION_ONLY"] },
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
        const response = await options.openCertsImportService.importOpenCerts(
          holderId,
          importOpenCertsRequestSchema.parse(request.body)
        );
        return reply.code(201).send(importOpenCertsResponseSchema.parse(response));
      } catch (error) {
        if (error instanceof Error && error.message === "OpenCerts upload too large") {
          return reply.code(413).send({ error: "OpenCerts upload too large" });
        }
        if (
          error instanceof Error &&
          error.message === "OpenCerts source retention is not available in Phase 2"
        ) {
          return reply.code(409).send({ error: "OpenCerts source retention is not available in Phase 2" });
        }
        if (error instanceof OpenCertsImportError) {
          return reply.code(error.statusCode).send(importOpenCertsFailureResponseSchema.parse(error.response));
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
      const holderId = request.user?.id;
      if (!holderId) {
        return reply.code(401).send({ error: "Unauthenticated" });
      }
      const params = deriveParamsSchema.parse(request.params);
      deriveFromOpenCertsImportRequestSchema.parse(request.body);
      try {
        const response = await options.openCertsImportService.deriveFromImport(holderId, params.importId);
        return reply.code(201).send(deriveFromOpenCertsImportResponseSchema.parse(response));
      } catch (error) {
        if (error instanceof OpenCertsDerivationError) {
          return reply.code(error.statusCode).send({ error: error.message });
        }
        throw error;
      }
    }
  );
}
