import fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { AppConfig } from "./config.js";
import { AuthService } from "./auth/auth-service.js";
import { TokenService } from "./auth/token-service.js";
import { authPlugin } from "./http/auth-plugin.js";
import { registerAuthRoutes } from "./routes/auth-routes.js";
import type { Prisma } from "./db.js";

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
  const authService = new AuthService(options.prisma, tokenService);
  await app.register(authPlugin, { prisma: options.prisma, tokenService });
  await registerAuthRoutes(app, { authService, cookieSecure: options.config.COOKIE_SECURE });

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
    app.log.error(error);
    return reply.code(500).send({ error: "Internal server error" });
  });

  return app;
}
