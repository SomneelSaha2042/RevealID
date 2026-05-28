import { z } from "zod";

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  AUTH_ACCESS_TOKEN_SECRET: z.string().min(32),
  AUTH_REFRESH_TOKEN_SECRET: z.string().min(32),
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true")
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return configSchema.parse({
    ...env,
    API_PORT: env.API_PORT ?? env.PORT
  });
}
