import type { FastifyInstance } from "fastify";
import {
  authUserSchema,
  loginRequestSchema,
  registerRequestSchema
} from "@revealid/contracts";
import type { AuthService } from "../auth/auth-service.js";
import { clearAuthCookies, setAuthCookies } from "../http/cookies.js";

export async function registerAuthRoutes(
  app: FastifyInstance,
  options: { authService: AuthService; cookieSecure: boolean }
) {
  const authResponseJson = {
    type: "object",
    required: ["user", "csrfToken"],
    properties: {
      user: {
        type: "object",
        required: ["id", "email", "name", "role"],
        properties: {
          id: { type: "string", format: "uuid" },
          email: { type: "string", format: "email" },
          name: { type: "string" },
          role: { type: "string", enum: ["HOLDER", "ISSUER"] }
        }
      },
      csrfToken: { type: "string" }
    }
  };

  app.post(
    "/auth/register",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "password", "name"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 12 },
            name: { type: "string", minLength: 1, maxLength: 120 }
          }
        },
        response: { 201: authResponseJson }
      }
    },
    async (request, reply) => {
      const input = registerRequestSchema.parse(request.body);
      const session = await options.authService.register(input);
      setAuthCookies(reply, session, { secure: options.cookieSecure });
      return reply.code(201).send({ user: session.user, csrfToken: session.csrfToken });
    }
  );

  app.post(
    "/auth/login",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 1 }
          }
        },
        response: { 200: authResponseJson }
      }
    },
    async (request, reply) => {
      const input = loginRequestSchema.parse(request.body);
      const session = await options.authService.login(input);
      setAuthCookies(reply, session, { secure: options.cookieSecure });
      return { user: session.user, csrfToken: session.csrfToken };
    }
  );

  app.post("/auth/logout", { preHandler: app.requireCsrf }, async (request, reply) => {
    await options.authService.logout(request.cookies.rid_refresh);
    clearAuthCookies(reply, options.cookieSecure);
    return { ok: true };
  });

  app.post("/auth/refresh", async (request, reply) => {
    const refreshToken = request.cookies.rid_refresh;
    if (!refreshToken) {
      return reply.code(401).send({ error: "Unauthenticated" });
    }
    const session = await options.authService.refresh(refreshToken);
    setAuthCookies(reply, session, { secure: options.cookieSecure });
    return { user: session.user, csrfToken: session.csrfToken };
  });

  app.get(
    "/me",
    {
      preHandler: app.authenticate,
      schema: {
        response: {
          200: {
            type: "object",
            required: ["user"],
            properties: {
              user: {
                type: "object",
                required: ["id", "email", "name", "role"],
                properties: {
                  id: { type: "string", format: "uuid" },
                  email: { type: "string", format: "email" },
                  name: { type: "string" },
                  role: { type: "string", enum: ["HOLDER", "ISSUER"] }
                }
              }
            }
          }
        }
      }
    },
    async (request) => {
      const user = authUserSchema.parse(request.user);
      return { user };
    }
  );

  app.get("/issuer/ping", { preHandler: app.requireIssuer }, async () => ({ ok: true }));
}
