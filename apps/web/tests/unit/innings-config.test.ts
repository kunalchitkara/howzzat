import { describe, expect, it } from "vitest";
import { getBuiltinProfile } from "@howzzat/rules-engine";
import { resolveInningsConfigForBatting } from "@/lib/scoring/innings-config";

describe("resolveInningsConfigForBatting", () => {
  const profile = getBuiltinProfile("demo-u9-4-over-v1")!;

  it("uses batting squad size for config (fixed 4 overs demo)", () => {
    const match = {
      homeTeamId: "tt-home",
      awayTeamId: "tt-away",
      homeTeam: { team: { id: "team-home" } },
      awayTeam: { team: { id: "team-away" } },
      playersPerSide: 4,
      squad: [
        { teamId: "team-home" },
        { teamId: "team-home" },
        { teamId: "team-home" },
        { teamId: "team-home" },
        { teamId: "team-home" },
        { teamId: "team-away" },
        { teamId: "team-away" },
        { teamId: "team-away" },
        { teamId: "team-away" },
      ],
    };

    const cfg = resolveInningsConfigForBatting(profile, match, "tt-home");
    expect(cfg.playersPerSide).toBe(5);
    expect(cfg.totalOvers).toBe(4);
  });

  it("uses match.totalOvers when set at squad confirm", () => {
    const profile = getBuiltinProfile("demo-u9-4-over-v1")!;
    const match = {
      homeTeamId: "tt-home",
      awayTeamId: "tt-away",
      homeTeam: { team: { id: "team-home" } },
      awayTeam: { team: { id: "team-away" } },
      playersPerSide: 10,
      totalOvers: 20,
      squad: Array.from({ length: 10 }, () => ({ teamId: "team-home" })),
    };

    const cfg = resolveInningsConfigForBatting(profile, match, "tt-home");
    expect(cfg.totalOvers).toBe(20);
  });
});
