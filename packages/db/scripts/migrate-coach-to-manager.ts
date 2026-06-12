/**
 * One-time migration: COACH org role → MANAGER, ORG_COACH invite kind → ORG_MANAGER.
 * Run before `prisma db push` if upgrading from a schema that used COACH / ORG_COACH.
 *
 *   pnpm --filter @howzzat/db exec tsx scripts/migrate-coach-to-manager.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const memberships = await prisma.$executeRawUnsafe(
    `UPDATE OrgMembership SET role = 'MANAGER' WHERE role = 'COACH'`,
  );
  const invitesRole = await prisma.$executeRawUnsafe(
    `UPDATE TournamentInvite SET role = 'MANAGER' WHERE role = 'COACH'`,
  );
  const invitesKind = await prisma.$executeRawUnsafe(
    `UPDATE TournamentInvite SET kind = 'ORG_MANAGER' WHERE kind = 'ORG_COACH'`,
  );
  console.log(
    `Migrated ${memberships} memberships, ${invitesRole} invite roles, ${invitesKind} invite kinds`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
