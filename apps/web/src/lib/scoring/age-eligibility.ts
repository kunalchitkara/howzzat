/** Parse max age from labels like U9, U10, Girls U11. */
export function parseAgeGroupCap(
  ageGroup: string | null | undefined,
): number | null {
  if (!ageGroup) return null;
  const match = ageGroup.match(/\bU\s*(\d{1,2})\b/i);
  return match ? Number(match[1]) : null;
}

export function ageOnDate(dateOfBirth: Date, on: Date): number {
  let age = on.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = on.getMonth() - dateOfBirth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && on.getDate() < dateOfBirth.getDate())) {
    age -= 1;
  }
  return age;
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
