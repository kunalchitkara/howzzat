import type { PrismaClient } from "@howzzat/db";
import { slugify } from "./api/slug";

type TournamentTeamForSlug = {
  publicSlug: string | null;
  team: { slug: string; name: string };
};

export function normalizeAgeGroup(ageGroup: string | null | undefined): string {
  if (!ageGroup?.trim()) return "open";
  return slugify(ageGroup);
}

/** Short team label for match URLs (edgware-u9 → edgware). */
export function teamMatchSlug(team: TournamentTeamForSlug): string {
  const raw = team.publicSlug ?? team.team.slug ?? slugify(team.team.name);
  return raw.replace(/-u\d+$/i, "").replace(/^u\d+-/i, "");
}

export function formatMatchDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export function buildMatchSlug(params: {
  ageGroup: string | null | undefined;
  homeTeam: TournamentTeamForSlug;
  awayTeam: TournamentTeamForSlug;
  scheduledAt?: Date | null;
  createdAt?: Date;
}): string {
  const age = normalizeAgeGroup(params.ageGroup);
  const home = teamMatchSlug(params.homeTeam);
  const away = teamMatchSlug(params.awayTeam);
  const date = formatMatchDate(
    params.scheduledAt ?? params.createdAt ?? new Date(),
  );
  return `${age}-${home}-${away}-${date}`;
}

export async function allocateUniqueMatchSlug(
  prisma: Pick<PrismaClient, "match">,
  base: string,
  excludeMatchId?: string,
): Promise<string> {
  let candidate = base;
  let suffix = 2;
  while (true) {
    const existing = await prisma.match.findUnique({ where: { slug: candidate } });
    if (!existing || (excludeMatchId && existing.id === excludeMatchId)) {
      return candidate;
    }
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

/** Prefer slug in public URLs; fall back to id for legacy rows. */
export function matchPublicRef(match: { id: string; slug: string | null }): string {
  return match.slug ?? match.id;
}

export function isCuid(ref: string): boolean {
  return /^c[a-z0-9]{20,}$/i.test(ref);
}
