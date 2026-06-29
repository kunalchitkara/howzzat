import { describe, expect, it } from "vitest";
import LegacyU9TournamentPage from "@/app/orgs/edgware-cc/tournaments/u9-2026/page";

describe("legacy public tournament link", () => {
  it("redirects stale u9-2026 URL to the public tournament hub", () => {
    expect(() => LegacyU9TournamentPage()).toThrowError(/NEXT_REDIRECT/);
  });
});
