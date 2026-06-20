/** Parse max age from labels like U9, U10, Girls U11. */
export function parseAgeGroupCap(
  ageGroup: string | null | undefined,
): number | null {
  if (!ageGroup) return null;
  const match = ageGroup.match(/\bU\s*(\d{1,2})\b/i);
  return match ? Number(match[1]) : null;
}

/** Canonical key for age-band matching, e.g. "U9" from "Girls U9" or "u9". */
export function canonicalAgeGroupKey(
  ageGroup: string | null | undefined,
): string | null {
  if (!ageGroup?.trim()) return null;
  const cap = parseAgeGroupCap(ageGroup);
  if (cap != null) return `U${cap}`;
  return ageGroup.trim().toLowerCase();
}

/** True when two age labels refer to the same band (e.g. U9 vs Girls U9). */
export function ageGroupsMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const ka = canonicalAgeGroupKey(a);
  const kb = canonicalAgeGroupKey(b);
  if (!ka || !kb) return false;
  return ka === kb;
}

export function ageOnDate(dateOfBirth: Date, on: Date): number {
  let age = on.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = on.getMonth() - dateOfBirth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && on.getDate() < dateOfBirth.getDate())) {
    age -= 1;
  }
  return age;
}

/** Compact age label for roster grids, e.g. "7yrs", "9yrs". */
export function formatPlayerAge(
  dateOfBirth: Date | null | undefined,
  on: Date = new Date(),
): string | null {
  if (!dateOfBirth) return null;
  return `${ageOnDate(dateOfBirth, on)}yrs`;
}

/** True when player is older than the tournament age band (e.g. age 10+ in U9). */
export function isOverAgeGroup(
  dateOfBirth: Date | null | undefined,
  ageGroupCap: number | null,
  on: Date,
): boolean {
  if (!dateOfBirth || ageGroupCap == null) return false;
  return ageOnDate(dateOfBirth, on) > ageGroupCap;
}
