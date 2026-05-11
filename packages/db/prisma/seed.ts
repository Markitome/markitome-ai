import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.organization.upsert({
    where: { domain: "markitome.com" },
    update: {},
    create: { name: "Markitome", domain: "markitome.com" }
  });

  for (const role of ["ADMIN", "MANAGER", "TEAM_MEMBER", "INTERN"] as const) {
    await prisma.role.upsert({
      where: { name: role },
      update: {},
      create: {
        name: role,
        description: `${role.replace("_", " ").toLowerCase()} role`
      }
    });
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Seed failed");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
