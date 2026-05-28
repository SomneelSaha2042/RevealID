import { PrismaClient } from "@prisma/client";

export function createPrismaClient() {
  return new PrismaClient({
    log: ["warn", "error"]
  });
}

export type Prisma = ReturnType<typeof createPrismaClient>;
