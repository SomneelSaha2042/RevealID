import { defineConfig, devices } from "@playwright/test";

const webBaseUrl = process.env.E2E_WEB_BASE_URL ?? "http://localhost:3000";
const apiBaseUrl = process.env.E2E_API_BASE_URL ?? "http://127.0.0.1:4000";
const shouldStartServers = process.env.E2E_SKIP_WEB_SERVER !== "true";

const apiEnv = {
  DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://revealid:revealid@localhost:5432/revealid?schema=public",
  API_HOST: "127.0.0.1",
  API_PORT: "4000",
  WEB_ORIGIN: webBaseUrl,
  API_BASE_URL: apiBaseUrl,
  AUTH_ACCESS_TOKEN_SECRET: "e2e-access-secret-at-least-32-characters",
  AUTH_REFRESH_TOKEN_SECRET: "e2e-refresh-secret-at-least-32-characters",
  CREDENTIAL_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  ISSUER_ID: apiBaseUrl,
  ISSUER_NAME: "Demo University",
  OPENCERTS_API_VERIFY_URL: "http://127.0.0.1:4010/verify",
  COOKIE_SECURE: "false",
  NODE_ENV: "development"
};

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: webBaseUrl,
    trace: "retain-on-failure"
  },
  webServer: shouldStartServers
    ? [
        {
          command: "node tests/e2e/opencerts-verify-stub.mjs",
          url: "http://127.0.0.1:4010/health",
          reuseExistingServer: true,
          timeout: 30_000
        },
        {
          command:
            "corepack pnpm db:generate && corepack pnpm db:migrate && corepack pnpm db:seed && corepack pnpm dev:api",
          url: `${apiBaseUrl}/health`,
          reuseExistingServer: true,
          timeout: 120_000,
          env: apiEnv
        },
        {
          command: "corepack pnpm dev:web",
          url: webBaseUrl,
          reuseExistingServer: true,
          timeout: 120_000,
          env: {
            API_BASE_URL: apiBaseUrl,
            NEXT_PUBLIC_API_BASE_URL: "/api",
            NODE_ENV: "development"
          }
        }
      ]
    : undefined,
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] }
    }
  ]
});
