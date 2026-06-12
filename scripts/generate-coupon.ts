#!/usr/bin/env tsx
/**
 * Create a wallet coupon in the database (local / ops use).
 *
 * Usage:
 *   COUPON_ADMIN_SECRET=dev-secret DATABASE_URL="file:./packages/db/prisma/dev.db" \
 *     pnpm exec tsx scripts/generate-coupon.ts --amount 2000 --note "beta tester"
 */
import { PrismaClient } from "@prisma/client";

function parseArgs(argv: string[]) {
  const opts: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        opts[key] = next;
        i++;
      } else {
        opts[key] = "true";
      }
    }
  }
  return opts;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(prefix = "HOWZZAT-ALPHA"): string {
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `${prefix}-${suffix}`;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));
  const amountPence = Number(args.amount ?? args.amountPence);
  if (!Number.isInteger(amountPence) || amountPence <= 0) {
    console.error("--amount <pence> is required (e.g. 2000 for £20)");
    process.exit(1);
  }

  const maxRedemptions = Number(args.maxRedemptions ?? 1);
  const note = args.note ?? null;
  const code = (args.code ?? generateCode()).trim().toUpperCase();
  const expiresAt = args.expiresAt ? new Date(args.expiresAt) : null;

  const prisma = new PrismaClient();
  try {
    const coupon = await prisma.walletCoupon.create({
      data: {
        code,
        amountPence,
        maxRedemptions,
        note,
        expiresAt,
      },
    });
    console.log(JSON.stringify(coupon, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
