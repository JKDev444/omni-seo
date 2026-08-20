import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx tsx scripts/deleteUser.ts <email>");
    process.exit(1);
  }
  const deleted = await prisma.user.deleteMany({ where: { email: email.toLowerCase() } });
  console.log(`Deleted ${deleted.count} user(s) matching ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
