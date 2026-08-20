/**
 * Creates or updates an internal login account.
 * Usage: npx tsx scripts/createUser.ts <email> <password> [name]
 * There's no signup UI on purpose — this script is the only way in.
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/auth/password";

const prisma = new PrismaClient();

async function main() {
  const [, , email, password, name] = process.argv;
  if (!email || !password) {
    console.error("Usage: npx tsx scripts/createUser.ts <email> <password> [name]");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const passwordHash = hashPassword(password);
  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: { passwordHash, name: name ?? undefined },
    create: { email: email.toLowerCase(), passwordHash, name: name ?? undefined },
  });

  console.log(`User ready: ${user.email} (id: ${user.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
