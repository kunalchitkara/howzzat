/** Standard youth and open age groups for teams and tournaments. */
export const AGE_GROUPS = [
  "U8",
  "U9",
  "U10",
  "U11",
  "U12",
  "U13",
  "U14",
  "U15",
  "U16",
  "U17",
  "U18",
  "Open",
  "Veterans",
  "Women",
] as const;

export type AgeGroup = (typeof AGE_GROUPS)[number];
