import type {
  BatterRow,
  BowlerRow,
  InningsScorecardView,
  MatchScorecardView,
  PartnershipRow,
} from "./types";

export interface MatchSummaryHighlight {
  label: string;
  name: string;
  detail: string;
}

export interface MatchSummaryInsight {
  emoji: string;
  title: string;
  body: string;
}

export interface MatchSummary {
  headline: string;
  variant: "win" | "loss" | "draw" | "neutral";
  meta: string;
  scores: { label: string; value: number }[];
  marginLabel: string;
  marginValue: string;
  overs: number;
  highlights: MatchSummaryHighlight[];
  playerOfMatch?: { name: string; detail: string };
  /** Upbeat, parent-friendly takeaways */
  parentInsights: MatchSummaryInsight[];
  /** Critical, coach-facing analysis from match data */
  coachInsights: MatchSummaryInsight[];
}

interface InsightContext {
  innings: InningsScorecardView[];
  margin: number;
  seed: number;
  first: InningsScorecardView;
  second?: InningsScorecardView;
  winner?: InningsScorecardView;
  loser?: InningsScorecardView;
}

function hashSeed(parts: (string | number)[]): number {
  const str = parts.join("|");
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickInsights(
  candidates: MatchSummaryInsight[],
  seed: number,
  count: number,
): MatchSummaryInsight[] {
  if (!candidates.length) return [];
  const rng = mulberry32(seed);
  const pool = [...candidates];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const seen = new Set<string>();
  const picked: MatchSummaryInsight[] = [];
  for (const c of pool) {
    if (seen.has(c.title)) continue;
    seen.add(c.title);
    picked.push(c);
    if (picked.length >= count) break;
  }
  return picked;
}

function topBatter(innings: InningsScorecardView): BatterRow | null {
  const batters = innings.batters.filter((b) => b.runs > 0 || b.balls > 0);
  if (!batters.length) return innings.batters[0] ?? null;
  return batters.reduce((best, b) => (b.runs > best.runs ? b : best));
}

function topBowler(innings: InningsScorecardView): BowlerRow | null {
  if (!innings.bowlers.length) return null;
  return innings.bowlers.reduce((best, b) => {
    if (b.wickets > best.wickets) return b;
    if (b.wickets === best.wickets && b.economy < best.economy) return b;
    return best;
  });
}

interface PlayerImpact {
  name: string;
  runs: number;
  wickets: number;
  catches: number;
  runOuts: number;
  netRuns: number;
  economy?: number;
}

function collectPlayerImpacts(innings: InningsScorecardView[]): PlayerImpact[] {
  const map = new Map<string, PlayerImpact>();

  const ensure = (name: string) => {
    let row = map.get(name);
    if (!row) {
      row = {
        name,
        runs: 0,
        wickets: 0,
        catches: 0,
        runOuts: 0,
        netRuns: 0,
      };
      map.set(name, row);
    }
    return row;
  };

  for (const inn of innings) {
    for (const b of inn.batters) {
      const row = ensure(b.name);
      row.runs = Math.max(row.runs, b.runs);
      row.netRuns = Math.max(row.netRuns, b.netRuns);
    }
    for (const b of inn.bowlers) {
      const row = ensure(b.name);
      row.wickets += b.wickets;
      if (b.overs >= 1) {
        row.economy =
          row.economy == null ? b.economy : Math.min(row.economy, b.economy);
      }
    }
    for (const f of inn.fielding) {
      const row = ensure(f.fielderName);
      row.catches += f.catches;
      row.runOuts += f.runOuts;
    }
  }

  return [...map.values()];
}

function pickPlayerOfMatch(innings: InningsScorecardView[]): PlayerImpact | null {
  const players = collectPlayerImpacts(innings);
  if (!players.length) return null;

  const scored = players.map((p) => ({
    ...p,
    score:
      p.runs * 2 +
      Math.max(0, p.netRuns) +
      p.wickets * 18 +
      p.catches * 12 +
      p.runOuts * 10 +
      (p.economy != null && p.economy <= 4 && p.wickets > 0 ? 8 : 0),
  }));

  return scored.reduce((best, p) => (p.score > best.score ? p : best));
}

function formatPotmDetail(p: PlayerImpact): string {
  const parts: string[] = [];
  if (p.runs > 0) parts.push(`${p.runs} run${p.runs === 1 ? "" : "s"}`);
  if (p.wickets > 0) parts.push(`${p.wickets} wkt${p.wickets === 1 ? "" : "s"}`);
  if (p.catches > 0) parts.push(`${p.catches} catch${p.catches === 1 ? "" : "es"}`);
  if (p.runOuts > 0) {
    parts.push(`${p.runOuts} run out${p.runOuts === 1 ? "" : "s"}`);
  }
  return parts.length ? parts.join(" · ") : "standout all-round effort";
}

function buildInsightContext(
  innings: InningsScorecardView[],
  margin: number,
  seedKey: string,
): InsightContext {
  const first = innings[0]!;
  const second = innings[1];
  let winner: InningsScorecardView | undefined;
  let loser: InningsScorecardView | undefined;
  if (second) {
    if (first.totalRuns > second.totalRuns) {
      winner = first;
      loser = second;
    } else if (second.totalRuns > first.totalRuns) {
      winner = second;
      loser = first;
    }
  }
  return {
    innings,
    margin,
    seed: hashSeed([
      seedKey,
      first.totalRuns,
      second?.totalRuns ?? 0,
      margin,
    ]),
    first,
    second,
    winner,
    loser,
  };
}

function generateParentInsights(ctx: InsightContext): MatchSummaryInsight[] {
  const candidates: MatchSummaryInsight[] = [];

  const allPartnerships = ctx.innings.flatMap((inn) =>
    inn.partnerships.map((p) => ({ ...p, team: inn.teamName })),
  );
  const bestPositive = allPartnerships
    .filter((p) => p.netRuns > 0)
    .sort((a, b) => b.netRuns - a.netRuns)[0];
  if (bestPositive) {
    candidates.push({
      emoji: "🏉",
      title: "Super partnership",
      body: `${bestPositive.batter1} & ${bestPositive.batter2} put on +${bestPositive.netRuns} net for ${bestPositive.team} — brilliant teamwork at the crease.`,
    });
  }

  const allBowlers = ctx.innings.flatMap((inn) =>
    inn.bowlers.filter((b) => b.overs >= 1).map((b) => ({ ...b, team: inn.teamName })),
  );
  const ecoStars = [...allBowlers]
    .filter((b) => b.economy <= 5)
    .sort((a, b) => a.economy - b.economy)
    .slice(0, 3);
  if (ecoStars.length) {
    const names = ecoStars.map((b) => b.name).join(", ");
    candidates.push({
      emoji: "⭐",
      title: "Tight bowling spells",
      body: `${names} kept things tight with economy under 5 — great discipline with the ball.`,
    });
  }

  const allBatters = ctx.innings.flatMap((inn) =>
    inn.batters.map((b) => ({ ...b, team: inn.teamName })),
  );
  const topScorer = allBatters.reduce<(typeof allBatters)[0] | null>(
    (acc, b) => (!acc || b.runs > acc.runs ? b : acc),
    null,
  );
  if (topScorer && topScorer.runs >= 4) {
    candidates.push({
      emoji: "🏏",
      title: "Star with the bat",
      body: `${topScorer.name} top-scored with ${topScorer.runs} runs — a lovely innings to watch.`,
    });
  }

  const notOuts = allBatters.filter((b) => b.isNotOut && b.runs > 0);
  if (notOuts.length) {
    const names = notOuts
      .slice(0, 3)
      .map((b) => b.name)
      .join(", ");
    candidates.push({
      emoji: "💪",
      title: "Stayed in and fought",
      body: `${names} finished not out — real determination to keep the innings going.`,
    });
  }

  const totalFours = allBatters.reduce((s, b) => s + b.fours, 0);
  const totalSixes = allBatters.reduce((s, b) => s + b.sixes, 0);
  if (totalFours + totalSixes > 0) {
    candidates.push({
      emoji: "🔴",
      title: "Boundaries to cheer",
      body: `${totalFours} four${totalFours === 1 ? "" : "s"} and ${totalSixes} six${totalSixes === 1 ? "" : "es"} — plenty of exciting shots for the crowd.`,
    });
  }

  const fielders = ctx.innings.flatMap((inn) => inn.fielding);
  const fieldHeroes = fielders.filter((f) => f.catches + f.runOuts > 0);
  if (fieldHeroes.length) {
    const top = fieldHeroes.sort(
      (a, b) => b.catches + b.runOuts - (a.catches + a.runOuts),
    )[0]!;
    candidates.push({
      emoji: "🤸",
      title: "Sharp in the field",
      body: `${top.fielderName} made a difference in the field${top.catches ? ` with ${top.catches} catch${top.catches === 1 ? "" : "es"}` : ""}${top.runOuts ? `${top.catches ? " and" : " with"} ${top.runOuts} run out${top.runOuts === 1 ? "" : "s"}` : ""}.`,
    });
  }

  if (ctx.margin > 0 && ctx.margin <= 20) {
    candidates.push({
      emoji: "💥",
      title: "So close!",
      body: `Only ${ctx.margin} runs in it — every single run and wicket really mattered. What a match.`,
    });
  }

  const contributors = allBatters.filter((b) => b.runs > 0);
  if (contributors.length >= 5) {
    candidates.push({
      emoji: "👏",
      title: "Everyone chipped in",
      body: `${contributors.length} players got runs on the board — a real team effort with the bat.`,
    });
  }

  const bestFigures = [...allBowlers].sort((a, b) => {
    if (b.wickets !== a.wickets) return b.wickets - a.wickets;
    return a.runs - b.runs;
  })[0];
  if (bestFigures && bestFigures.wickets >= 2) {
    candidates.push({
      emoji: "🎯",
      title: "Wickets for the bowlers",
      body: `${bestFigures.name} took ${bestFigures.wickets} wicket${bestFigures.wickets === 1 ? "" : "s"} — brilliant work with the ball.`,
    });
  }

  if (ctx.loser && ctx.margin >= 20) {
    candidates.push({
      emoji: "🌱",
      title: "Lots to build on",
      body: `A tough scoreboard, but every pair and over is experience gained. Plenty to be proud of and learn from.`,
    });
  }

  const totalRuns = ctx.innings.reduce((s, inn) => s + inn.totalRuns, 0);
  if (totalRuns >= 500) {
    candidates.push({
      emoji: "📈",
      title: "Runs galore",
      body: `${totalRuns} runs in the match — an entertaining game for parents and players alike.`,
    });
  }

  const positivePairs = allPartnerships.filter((p) => p.netRuns > 0);
  if (positivePairs.length >= 2) {
    candidates.push({
      emoji: "🤝",
      title: "Pairs cricket at its best",
      body: `${positivePairs.length} partnerships finished in positive net — pairs looking after each other at the crease.`,
    });
  }

  return pickInsights(candidates, ctx.seed, 6);
}

function generateCoachInsights(ctx: InsightContext): MatchSummaryInsight[] {
  const candidates: MatchSummaryInsight[] = [];

  const allPartnerships = ctx.innings.flatMap((inn) =>
    inn.partnerships.map((p) => ({ ...p, team: inn.teamName })),
  );
  const worst = allPartnerships
    .filter((p) => p.netRuns < 0)
    .sort((a, b) => a.netRuns - b.netRuns)[0];
  if (worst) {
    candidates.push({
      emoji: "⚠️",
      title: `Weak pair: ${worst.label} (${worst.team})`,
      body: `${worst.batter1} & ${worst.batter2} finished at ${worst.netRuns} net with ${worst.wickets} wicket${worst.wickets === 1 ? "" : "s"} — review calling, running, and shot selection in the next pair session.`,
    });
  }

  if (ctx.loser) {
    const negBatters = ctx.loser.batters.filter((b) => b.netRuns < 0);
    if (negBatters.length >= 3) {
      candidates.push({
        emoji: "📉",
        title: `${ctx.loser.teamName}: negative net runs`,
        body: `${negBatters.length} batters finished negative net (${negBatters.map((b) => b.name).slice(0, 4).join(", ")}${negBatters.length > 4 ? "…" : ""}) — wicket preservation must come before expansive shots.`,
      });
    }

    if (ctx.loser.wickets >= 10) {
      candidates.push({
        emoji: "🚫",
        title: `${ctx.loser.teamName}: too many wickets`,
        body: `${ctx.loser.wickets} wickets lost — soft dismissals and run-outs inflated the damage. Drill calling under pressure and "do not run on misfields".`,
      });
    }

    if (ctx.loser.batRunsFromPlay < 40 && ctx.loser.overs >= 16) {
      candidates.push({
        emoji: "🏏",
        title: `${ctx.loser.teamName}: low runs from play`,
        body: `Only ${ctx.loser.batRunsFromPlay} bat runs from ${ctx.loser.overs} overs — strike rotation and finding the gap need structured nets work, not just boundary hunting.`,
      });
    }

    const loserFours = ctx.loser.batters.reduce((s, b) => s + b.fours + b.sixes, 0);
    if (loserFours <= 2 && ctx.loser.batRunsFromPlay < 50) {
      candidates.push({
        emoji: "🔒",
        title: `${ctx.loser.teamName}: boundary drought`,
        body: `Just ${loserFours} boundary${loserFours === 1 ? "" : "ies"} and few runs off the bat — batters blocked themselves in; work on placement and soft-hand singles.`,
      });
    }
  }

  if (ctx.winner && ctx.loser) {
    const winTop = topBatter(ctx.winner);
    const loseTop = topBatter(ctx.loser);
    if (winTop && loseTop && winTop.runs - loseTop.runs >= 6) {
      candidates.push({
        emoji: "🎯",
        title: "Opposition anchor",
        body: `${winTop.name} (${winTop.runs}) outscored our top batter ${loseTop.name} (${loseTop.runs}) — plan specific bowler match-ups and field settings for their set batter next time.`,
      });
    }
  }

  const allBowlers = ctx.innings.flatMap((inn) =>
    inn.bowlers.map((b) => ({
      ...b,
      battingTeam: inn.teamName,
    })),
  );
  const expensive = allBowlers
    .filter((b) => b.overs >= 1 && b.economy >= 7)
    .sort((a, b) => b.economy - a.economy);
  if (expensive.length) {
    const names = expensive
      .slice(0, 3)
      .map((b) => `${b.name} (${b.economy})`)
      .join(", ");
    candidates.push({
      emoji: "📊",
      title: "Expensive overs",
      body: `${names} — economy above 7 hurts pairs totals quickly. Check lengths, wide discipline, and whether to rotate bowlers earlier.`,
    });
  }

  const economical = allBowlers
    .filter((b) => b.overs >= 1 && b.economy <= 4 && b.wickets === 0)
    .sort((a, b) => a.economy - b.economy);
  if (economical.length >= 2) {
    candidates.push({
      emoji: "🔷",
      title: "Pressure without wickets",
      body: `${economical.map((b) => b.name).slice(0, 3).join(", ")} bowled economically but took no wickets — attack may have been too straight; work on stumps lines and catching up to the batter.`,
    });
  }

  const wicketTakers = allBowlers
    .filter((b) => b.wickets >= 3)
    .sort((a, b) => b.wickets - a.wickets);
  if (wicketTakers[0]) {
    const b = wicketTakers[0];
    candidates.push({
      emoji: "🎯",
      title: "Threat bowler to plan for",
      body: `${b.name} finished ${b.wickets}/${b.runs} — opposition will build around this spell; batters need a clear game plan (leave, rotate, or target weaker bowlers).`,
    });
  }

  const extrasByInnings = ctx.innings.map((inn) => ({
    team: inn.teamName,
    extras: inn.extras,
    wides: inn.bowlers.reduce((s, b) => s + b.wides, 0),
    noBalls: inn.bowlers.reduce((s, b) => s + b.noBalls, 0),
  }));
  for (const row of extrasByInnings) {
    const disciplineExtras = row.wides * 2 + row.noBalls * 2 + row.extras.total;
    if (disciplineExtras >= 12 || row.wides >= 5) {
      candidates.push({
        emoji: "➕",
        title: `${row.team}: extras leaked`,
        body: `${row.wides} wide${row.wides === 1 ? "" : "s"} and ${row.noBalls} no-ball${row.noBalls === 1 ? "" : "s"} conceded — free runs that swing close pairs games. Bowling machine: land it on a tee.`,
      });
      break;
    }
  }

  const negativePairs = allPartnerships.filter((p) => p.netRuns < -5);
  if (negativePairs.length >= 2) {
    candidates.push({
      emoji: "🔗",
      title: "Multiple pair collapses",
      body: `${negativePairs.length} partnerships finished below −5 net — pattern suggests communication breakdowns, not one-off mistakes. Run a pairs calling drill before the next match.`,
    });
  }

  if (ctx.loser && ctx.margin >= 30) {
    candidates.push({
      emoji: "📋",
      title: "Margin analysis",
      body: `Lost by ${ctx.margin} — gap is large enough to review innings structure (target per pair, who faces which bowlers) rather than individual moments only.`,
    });
  }

  if (ctx.winner) {
    const weakPairs = ctx.winner.partnerships.filter((p) => p.netRuns < 0);
    if (weakPairs.length) {
      const p = weakPairs.sort((a, b) => a.netRuns - b.netRuns)[0]!;
      candidates.push({
        emoji: "✅",
        title: `${ctx.winner.teamName}: won despite weak pair`,
        body: `${p.batter1} & ${p.batter2} (${p.netRuns} net) — winning side still had a leaky pair; opposition can target that pattern if repeated.`,
      });
    }
  }

  const lowDots = allBowlers
    .filter((b) => b.overs >= 2 && b.dots <= 3)
    .sort((a, b) => a.dots - b.dots);
  if (lowDots.length) {
    candidates.push({
      emoji: "⚪",
      title: "Not enough dot balls",
      body: `${lowDots[0]!.name} (${lowDots[0]!.dots} dots in ${lowDots[0]!.overs} overs) — batters scored too easily; reward hitting the spot and building pressure over the pair.`,
    });
  }

  const fielders = ctx.innings.flatMap((inn) => inn.fielding);
  if (ctx.loser && ctx.loser.wickets >= 8 && fielders.length === 0) {
    candidates.push({
      emoji: "🧤",
      title: "Fielding chances not taken",
      body: `No catches or run-outs recorded despite ${ctx.loser.wickets} wickets — either chances went down or field was too deep; sharpen infield attack and catching circle.`,
    });
  }

  if (ctx.second && ctx.loser === ctx.second) {
    const chaseGap = ctx.first.totalRuns - ctx.second.totalRuns;
    if (chaseGap > 0) {
      const reqPerOver = chaseGap / ctx.second.overs;
      candidates.push({
        emoji: "⏱️",
        title: "Chase rate from the start",
        body: `Needed ~${Math.ceil(reqPerOver)} extra runs per over from ball one — early wickets or quiet pairs let the required rate climb. First pair must set the tempo.`,
      });
    }
  }

  const seen = new Set<string>();
  return candidates
    .sort((a, b) => a.title.localeCompare(b.title))
    .filter((c) => {
      if (seen.has(c.title)) return false;
      seen.add(c.title);
      return true;
    });
}

export function buildMatchSummary(data: MatchScorecardView): MatchSummary | null {
  if (!data.innings.length) return null;

  const first = data.innings[0]!;
  const second = data.innings[1];
  const overs = first.overs;

  const metaParts = [
    data.date,
    data.matchTitle,
    data.venue,
    overs ? `${overs} Overs` : undefined,
  ].filter(Boolean);

  const margin = second ? Math.abs(first.totalRuns - second.totalRuns) : 0;
  const ctx = buildInsightContext(
    data.innings,
    margin,
    data.matchTitle + (data.date ?? ""),
  );

  if (!second) {
    const top = topBatter(first);
    const potm = pickPlayerOfMatch(data.innings);
    return {
      headline: data.resultBanner?.text ?? `${first.teamName} — ${first.totalRuns}/${first.wickets}`,
      variant: data.resultBanner?.variant ?? "neutral",
      meta: metaParts.join(" · "),
      scores: [{ label: `${first.teamName} score`, value: first.totalRuns }],
      marginLabel: "Innings",
      marginValue: `${first.wickets} wkts`,
      overs,
      highlights: top
        ? [{ label: "Top bat", name: top.name, detail: `${top.runs} runs` }]
        : [],
      playerOfMatch: potm
        ? { name: potm.name, detail: formatPotmDetail(potm) }
        : undefined,
      parentInsights: generateParentInsights(ctx),
      coachInsights: generateCoachInsights(ctx),
    };
  }

  const score1 = first.totalRuns;
  const score2 = second.totalRuns;
  const firstWon = score1 > score2;
  const winner = firstWon ? first.teamName : second.teamName;
  const headline =
    data.resultBanner?.text ??
    (score1 === score2
      ? "Match tied"
      : `${winner} won by ${margin} run${margin === 1 ? "" : "s"}`);

  const variant =
    data.resultBanner?.variant ??
    (score1 === score2 ? "draw" : "neutral");

  const top1 = topBatter(first);
  const top2 = topBatter(second);
  const bowl1 = topBowler(second);
  const bowl2 = topBowler(first);
  const topBowl =
    bowl1 && bowl2
      ? bowl1.wickets > bowl2.wickets ||
          (bowl1.wickets === bowl2.wickets && bowl1.economy < bowl2.economy)
        ? bowl1
        : bowl2
      : bowl1 ?? bowl2;

  const highlights: MatchSummaryHighlight[] = [];
  if (top1) {
    highlights.push({
      label: `Top bat ${first.teamName}`,
      name: top1.name,
      detail: `${top1.runs} runs`,
    });
  }
  if (top2) {
    highlights.push({
      label: `Top bat ${second.teamName}`,
      name: top2.name,
      detail: `${top2.runs} runs`,
    });
  }
  if (topBowl) {
    highlights.push({
      label: "Top bowl",
      name: topBowl.name,
      detail:
        topBowl.wickets > 0
          ? `${topBowl.wickets} wkt${topBowl.wickets === 1 ? "" : "s"} · eco ${topBowl.economy}`
          : `eco ${topBowl.economy}`,
    });
  }

  const potm = pickPlayerOfMatch(data.innings);

  return {
    headline,
    variant,
    meta: metaParts.join(" · "),
    scores: [
      { label: `${first.teamName} score`, value: score1 },
      { label: `${second.teamName} score`, value: score2 },
    ],
    marginLabel: score1 === score2 ? "Result" : firstWon ? "Won by" : "Lost by",
    marginValue:
      score1 === score2 ? "Tied" : `${margin} run${margin === 1 ? "" : "s"}`,
    overs,
    highlights,
    playerOfMatch: potm
      ? { name: potm.name, detail: formatPotmDetail(potm) }
      : undefined,
    parentInsights: generateParentInsights(ctx),
    coachInsights: generateCoachInsights(ctx),
  };
}

/** Compact match header for the Commentary tab — live-aware headline. */
export function buildCommentaryMatchSummary(
  data: MatchScorecardView,
): MatchSummary | null {
  const summary = buildMatchSummary(data);
  if (!summary) return null;

  if (data.status === "COMPLETED" || data.resultBanner) {
    return summary;
  }

  const first = data.innings[0]!;
  const second = data.innings[1];

  if (!second) {
    return {
      ...summary,
      headline: `${first.teamName} ${first.totalRuns}/${first.wickets}`,
      variant: "neutral",
      marginLabel: "Status",
      marginValue: "Live",
    };
  }

  return {
    ...summary,
    headline: `${first.teamName} ${first.totalRuns} · ${second.teamName} ${second.totalRuns}/${second.wickets}`,
    variant: "neutral",
    marginLabel: "Status",
    marginValue: "Live",
  };
}
