import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const seededUsers = [
  {
    email: "issuer@demo-university.edu",
    name: "Demo University",
    role: "ISSUER" as const,
    password: "DemoIssuerPass123!"
  },
  {
    email: "holder@example.edu",
    name: "Sample Holder",
    role: "HOLDER" as const,
    password: "DemoHolderPass123!"
  }
];

async function main() {
  for (const user of seededUsers) {
    const passwordHash = await argon2.hash(user.password, { type: argon2.argon2id });
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        passwordHash
      },
      create: {
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash
      }
    });
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  });
