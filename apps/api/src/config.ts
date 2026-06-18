import { z } from "zod";

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  AUTH_ACCESS_TOKEN_SECRET: z.string().min(32),
  AUTH_REFRESH_TOKEN_SECRET: z.string().min(32),
  CREDENTIAL_ENCRYPTION_KEY: z.string().optional(),
  ISSUER_PRIVATE_JWK: z.string().optional(),
  ISSUER_ID: z.string().url().default("http://localhost:4000"),
  ISSUER_NAME: z.string().min(1).default("RevealID Demo Issuer"),
  OPENCERTS_VERIFICATION_MODE: z.enum(["LOCAL_TRUSTVC", "OPENCERTS_API"]).default("LOCAL_TRUSTVC"),
  OPENCERTS_ISSUER_POLICY_MODE: z.enum(["DEMO", "INSTITUTION_ONLY"]).default("DEMO"),
  OPENCERTS_API_VERIFY_URL: z.string().url().default("https://api.opencerts.io/verify"),
  OPENCERTS_RPC_PROVIDER_URL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().url().optional()
  ),
  MAX_OPENCERTS_UPLOAD_BYTES: z.coerce.number().int().positive().default(1_048_576),
  OPENCERTS_RETAIN_SOURCE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  OPENCERTS_SOURCE_RETENTION_DAYS: z.coerce.number().int().positive().default(31),
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
