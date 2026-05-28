import fp from "fastify-plugin";
import type { FastifyReply } from "fastify";
import type { AuthUser, Role } from "@revealid/contracts";
import { TokenService } from "../auth/token-service.js";
import type { Prisma } from "../db.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: import("fastify").FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireIssuer: (request: import("fastify").FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireCsrf: (request: import("fastify").FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    user?: AuthUser;
    sessionId?: string;
    csrfToken?: string;
  }
}

export const authPlugin = fp<{
  prisma: Prisma;
  tokenService: TokenService;
}>(async (app, { prisma, tokenService }) => {
  app.decorate("authenticate", async (request, reply) => {
    const accessToken = request.cookies.rid_access;
    if (!accessToken) {
      return reply.code(401).send({ error: "Unauthenticated" });
    }

    try {
      const payload = await tokenService.verifyAccessToken(accessToken);
      const session = await prisma.refreshSession.findUnique({
        where: { id: payload.sessionId },
        include: { user: true }
      });
      if (!session || session.revokedAt || session.expiresAt <= new Date()) {
        return reply.code(401).send({ error: "Unauthenticated" });
      }

      request.sessionId = session.id;
      request.csrfToken = payload.csrfToken;
      request.user = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role as Role
      };
    } catch {
      return reply.code(401).send({ error: "Unauthenticated" });
    }
  });

  app.decorate("requireIssuer", async (request, reply) => {
    await app.authenticate(request, reply);
    if (reply.sent) return;
    if (request.user?.role !== "ISSUER") {
      return reply.code(403).send({ error: "Issuer role required" });
    }
  });

  app.decorate("requireCsrf", async (request, reply) => {
    await app.authenticate(request, reply);
    if (reply.sent) return;

    const csrfHeader = request.headers["x-csrf-token"];
    const csrfCookie = request.cookies.rid_csrf;
    if (
      typeof csrfHeader !== "string" ||
      !csrfCookie ||
      csrfHeader !== csrfCookie ||
      csrfHeader !== request.csrfToken
    ) {
      return reply.code(403).send({ error: "CSRF token required" });
    }
  });
});
