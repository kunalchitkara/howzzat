import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const PUBLIC_HUB_PATH = "/orgs/edgware-cc/tournaments/u9-2026";
const LEGACY_PAGE = path.join(
  process.cwd(),
  "src/app/orgs/edgware-cc/tournaments/u9-2026/page.tsx",
);

describe("legacy public tournament link", () => {
  it("must not redirect the public hub URL to itself", () => {
    if (!existsSync(LEGACY_PAGE)) return;

    const content = readFileSync(LEGACY_PAGE, "utf8");
    const selfRedirect = new RegExp(
      `redirect\\s*\\(\\s*["'\`]${PUBLIC_HUB_PATH.replace(/\//g, "\\/")}["'\`]\\s*\\)`,
    );
    expect(content).not.toMatch(selfRedirect);
  });

  it("serves u9-2026 via the dynamic org/tournament route", () => {
    const dynamicPage = path.join(
      process.cwd(),
      "src/app/orgs/[orgSlug]/tournaments/[tournamentSlug]/page.tsx",
    );
    expect(existsSync(dynamicPage)).toBe(true);
  });
});
