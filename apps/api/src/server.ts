import { loadConfig } from "./config.js";
import { createPrismaClient } from "./db.js";
import { buildApp } from "./app.js";

const config = loadConfig();
const prisma = createPrismaClient();
const app = await buildApp({ config, prisma });

const close = async () => {
  await app.close();
  await prisma.$disconnect();
};

process.on("SIGINT", close);
process.on("SIGTERM", close);

await app.listen({ host: config.API_HOST, port: config.API_PORT });
