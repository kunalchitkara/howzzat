"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { AGE_GROUPS } from "@/lib/age-groups";
import { apiFetch } from "@/lib/client/api";
import {
  isDemoRulesTemplate,
  rulesTemplateDescription,
  templateOptionLabel as templateOptionLabelFromLib,
} from "@/lib/rules/template-labels";
import { btn, card, Field, input } from "./ui";

function AgeGroupSelect({
  value,
  onChange,
  style,
}: {
  value: string;
  onChange: (value: string) => void;
  style: CSSProperties;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={style}>
      {AGE_GROUPS.map((group) => (
        <option key={group} value={group}>
          {group}
        </option>
      ))}
    </select>
  );
}

function useSubmit<T>(onDone?: () => void) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(path: string, body: unknown, redirect?: string) {
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<T>(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      onDone?.();
      if (redirect) {
        router.push(redirect);
        router.refresh();
      }
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      return null;
    } finally {
      setBusy(false);
    }
  }

  return { run, error, busy };
}

export function CreateOrgForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const { run, error, busy } = useSubmit<{ id: string }>();

  return (
    <form
      style={card}
      onSubmit={(e) => {
        e.preventDefault();
        void run("/api/v1/organizations", { name }).then((org) => {
          if (org?.id) {
            router.push(`/dashboard/organizations/${org.id}`);
            router.refresh();
          }
        });
      }}
    >
      <Field label="Club name">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={input}
        />
      </Field>
      {error && <p style={{ color: "var(--red)", marginBottom: 12 }}>{error}</p>}
      <button type="submit" disabled={busy} style={btn}>
        Create organization
      </button>
    </form>
  );
}

export function CreateTeamForm({ orgId }: { orgId: string }) {
  const [name, setName] = useState("");
  const [ageGroup, setAgeGroup] = useState("U9");
  const { run, error, busy } = useSubmit<{ id: string }>();

  return (
    <form
      style={card}
      onSubmit={(e) => {
        e.preventDefault();
        void run(
          `/api/v1/organizations/${orgId}/teams`,
          { name, ageGroup },
          `/dashboard/organizations/${orgId}/teams`,
        );
      }}
    >
      <Field label="Team name">
        <input required value={name} onChange={(e) => setName(e.target.value)} style={input} />
      </Field>
      <Field label="Age group">
        <AgeGroupSelect value={ageGroup} onChange={setAgeGroup} style={input} />
      </Field>
      {error && <p style={{ color: "var(--red)", marginBottom: 12 }}>{error}</p>}
      <button type="submit" disabled={busy} style={btn}>
        Add team
      </button>
    </form>
  );
}

export function AddPlayerForm({ teamId }: { teamId: string }) {
  const router = useRouter();
  const [legalName, setLegalName] = useState("");
  const [shirtNumber, setShirtNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const { run, error, busy } = useSubmit();

  return (
    <form
      style={card}
      onSubmit={(e) => {
        e.preventDefault();
        void run(`/api/v1/teams/${teamId}/players`, {
          legalName,
          shirtNumber: shirtNumber ? Number(shirtNumber) : undefined,
          dateOfBirth: dateOfBirth
            ? new Date(dateOfBirth).toISOString()
            : undefined,
          seasonLabel: "2026",
        }).then((ok) => {
          if (ok) {
            setLegalName("");
            setShirtNumber("");
            setDateOfBirth("");
            router.refresh();
          }
        });
      }}
    >
      <Field label="Player name">
        <input
          required
          value={legalName}
          onChange={(e) => setLegalName(e.target.value)}
          style={input}
        />
      </Field>
      <Field label="Date of birth">
        <input
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          style={input}
        />
      </Field>
      <Field label="Shirt number">
        <input
          type="number"
          min={0}
          max={99}
          value={shirtNumber}
          onChange={(e) => setShirtNumber(e.target.value)}
          style={input}
        />
      </Field>
      {error && <p style={{ color: "var(--red)", marginBottom: 12 }}>{error}</p>}
      <button type="submit" disabled={busy} style={btn}>
        Add player
      </button>
    </form>
  );
}

type RulesTemplateOption = {
  builtinId: string | null;
  name: string;
  description: string | null;
  isSuggested?: boolean;
  latestVersion: {
    config?: {
      description?: string;
      format?: string;
      league?: { prefix?: string; sourceUrl?: string; ageGroup?: string };
      startingScore?: number;
      wicketPenalty?: number;
      pairOvers?: number;
      playersPerSide?: { default?: number; min?: number; max?: number };
      oversPerInnings?: { formula?: string };
      scoring?: {
        wide?: { default?: { runs?: number; rebowl?: boolean } };
        noBall?: { default?: { runs?: number; rebowl?: boolean } };
      };
    };
  } | null;
};

function templateOptionLabel(t: RulesTemplateOption): string {
  return templateOptionLabelFromLib(t.name);
}

const suggestedBadgeStyle = {
  display: "inline-block",
  marginLeft: 8,
  padding: "0.15rem 0.5rem",
  borderRadius: 9999,
  fontSize: "0.75rem",
  fontWeight: 700,
  background: "var(--gold, #f5e6a8)",
  color: "var(--dk)",
  verticalAlign: "middle",
} as const;

function groupTemplates(templates: RulesTemplateOption[]) {
  const coachFacing = templates.filter((t) => !isDemoRulesTemplate(t.builtinId));
  const u9 = coachFacing.filter(
    (t) =>
      t.builtinId === "mjca-u9-outdoor-v1" ||
      t.builtinId === "u9-softball-london-v1" ||
      t.latestVersion?.config?.league?.ageGroup === "U9",
  );
  const boys = coachFacing.filter(
    (t) =>
      t.builtinId?.startsWith("mjca-u") &&
      !t.builtinId?.includes("girls") &&
      !u9.includes(t),
  );
  const girls = coachFacing.filter((t) => t.builtinId?.includes("girls-"));
  const other = coachFacing.filter(
    (t) => !u9.includes(t) && !boys.includes(t) && !girls.includes(t),
  );
  const sortByName = (a: RulesTemplateOption, b: RulesTemplateOption) =>
    a.name.localeCompare(b.name);
  return {
    u9: u9.sort(sortByName),
    boys: boys.sort(sortByName),
    girls: girls.sort(sortByName),
    other: other.sort(sortByName),
  };
}

export function CreateTournamentForm({
  orgId,
  templates,
}: {
  orgId: string;
  templates: RulesTemplateOption[];
}) {
  const coachTemplates = templates.filter((t) => !isDemoRulesTemplate(t.builtinId));
  const defaultBuiltin =
    coachTemplates.find((t) => t.builtinId === "mjca-u9-outdoor-v1")?.builtinId ??
    coachTemplates.find((t) => t.builtinId === "u9-softball-london-v1")?.builtinId ??
    coachTemplates[0]?.builtinId ??
    "mjca-u9-outdoor-v1";

  const [name, setName] = useState("");
  const [ageGroup, setAgeGroup] = useState("U9");
  const [seasonLabel, setSeasonLabel] = useState("Summer 2026");
  const [builtinId, setBuiltinId] = useState(defaultBuiltin);
  const [customizeRules, setCustomizeRules] = useState(false);
  const [startingScore, setStartingScore] = useState("");
  const [wicketPenalty, setWicketPenalty] = useState("");
  const [playersDefault, setPlayersDefault] = useState("");
  const [wideRuns, setWideRuns] = useState("2");
  const [noBallRuns, setNoBallRuns] = useState("2");
  const [wideRebowl, setWideRebowl] = useState("false");
  const [noBallRebowl, setNoBallRebowl] = useState("false");
  const { run, error, busy } = useSubmit<{ id: string }>();

  const selected = coachTemplates.find((t) => t.builtinId === builtinId);
  const config = selected?.latestVersion?.config;
  const showSuggestedBadge =
    ageGroup.trim().toUpperCase() === "U9" && Boolean(selected?.isSuggested);
  const { u9, boys, girls, other } = groupTemplates(templates);

  function applyTemplateDefaults(id: string) {
    const tpl = templates.find((t) => t.builtinId === id);
    const cfg = tpl?.latestVersion?.config;
    if (!cfg) return;
    setStartingScore(String(cfg.startingScore ?? ""));
    setWicketPenalty(String(cfg.wicketPenalty ?? ""));
    setPlayersDefault(String(cfg.playersPerSide?.default ?? ""));
    setWideRuns(String(cfg.scoring?.wide?.default?.runs ?? 2));
    setNoBallRuns(String(cfg.scoring?.noBall?.default?.runs ?? 2));
    setWideRebowl(String(cfg.scoring?.wide?.default?.rebowl ?? false));
    setNoBallRebowl(String(cfg.scoring?.noBall?.default?.rebowl ?? false));
    if (cfg.league?.ageGroup) setAgeGroup(cfg.league.ageGroup);
  }

  function buildOverrides(): Record<string, unknown> | undefined {
    if (!customizeRules || !config) return undefined;
    const overrides: Record<string, unknown> = {};
    if (startingScore !== "" && Number(startingScore) !== config.startingScore) {
      overrides.startingScore = Number(startingScore);
    }
    if (wicketPenalty !== "" && Number(wicketPenalty) !== config.wicketPenalty) {
      overrides.wicketPenalty = Number(wicketPenalty);
    }
    if (
      playersDefault !== "" &&
      Number(playersDefault) !== config.playersPerSide?.default
    ) {
      overrides.playersPerSide = { default: Number(playersDefault) };
    }
    const scoring: Record<string, unknown> = {};
    const wideDefault = config.scoring?.wide?.default;
    const noBallDefault = config.scoring?.noBall?.default;
    const wideRunsNum = wideRuns !== "" ? Number(wideRuns) : undefined;
    const noBallRunsNum = noBallRuns !== "" ? Number(noBallRuns) : undefined;
    const wideRebowlBool = wideRebowl === "true";
    const noBallRebowlBool = noBallRebowl === "true";
    if (
      wideRunsNum !== undefined &&
      (wideRunsNum !== wideDefault?.runs || wideRebowlBool !== wideDefault?.rebowl)
    ) {
      scoring.wide = {
        default: { runs: wideRunsNum, rebowl: wideRebowlBool },
      };
    }
    if (
      noBallRunsNum !== undefined &&
      (noBallRunsNum !== noBallDefault?.runs ||
        noBallRebowlBool !== noBallDefault?.rebowl)
    ) {
      scoring.noBall = {
        default: { runs: noBallRunsNum, rebowl: noBallRebowlBool },
      };
    }
    if (Object.keys(scoring).length > 0) overrides.scoring = scoring;
    return Object.keys(overrides).length > 0 ? overrides : undefined;
  }

  return (
    <form
      style={card}
      onSubmit={(e) => {
        e.preventDefault();
        const body: Record<string, unknown> = {
          name,
          ageGroup,
          seasonLabel,
          rulesTemplateBuiltinId: builtinId,
          isPublic: true,
        };
        const overrides = buildOverrides();
        if (overrides) body.rulesOverrides = overrides;
        void run(
          `/api/v1/organizations/${orgId}/tournaments`,
          body,
          `/dashboard/organizations/${orgId}/tournaments`,
        );
      }}
    >
      <Field label="Tournament name">
        <input required value={name} onChange={(e) => setName(e.target.value)} style={input} />
      </Field>
      <Field label="Age group">
        <AgeGroupSelect value={ageGroup} onChange={setAgeGroup} style={input} />
      </Field>
      <Field label="Season">
        <input
          value={seasonLabel}
          onChange={(e) => setSeasonLabel(e.target.value)}
          style={input}
        />
      </Field>
      <Field label="Rules template">
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <select
            value={builtinId}
            onChange={(e) => {
              setBuiltinId(e.target.value);
              applyTemplateDefaults(e.target.value);
            }}
            style={{ ...input, flex: "1 1 220px", marginBottom: 0 }}
          >
            {u9.length > 0 && (
              <optgroup label="U9">
                {u9.map((t) => (
                  <option key={t.builtinId!} value={t.builtinId!}>
                    {templateOptionLabel(t)}
                  </option>
                ))}
              </optgroup>
            )}
            {boys.length > 0 && (
              <optgroup label="Boys & senior">
                {boys.map((t) => (
                  <option key={t.builtinId!} value={t.builtinId!}>
                    {templateOptionLabel(t)}
                  </option>
                ))}
              </optgroup>
            )}
            {girls.length > 0 && (
              <optgroup label="Girls">
                {girls.map((t) => (
                  <option key={t.builtinId!} value={t.builtinId!}>
                    {templateOptionLabel(t)}
                  </option>
                ))}
              </optgroup>
            )}
            {other.length > 0 && (
              <optgroup label="Other">
                {other.map((t) => (
                  <option key={t.builtinId ?? t.name} value={t.builtinId ?? ""}>
                    {templateOptionLabel(t)}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          {showSuggestedBadge && <span style={suggestedBadgeStyle}>Suggested</span>}
        </div>
      </Field>
      {config && (
        <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: 12 }}>
          {rulesTemplateDescription(config, selected?.description ?? config.description)}
          {config.league?.sourceUrl && (
            <>
              {" "}
              <a href={config.league.sourceUrl} target="_blank" rel="noreferrer">
                MJCA rules
              </a>
            </>
          )}
        </p>
      )}
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <input
          type="checkbox"
          checked={customizeRules}
          onChange={(e) => {
            setCustomizeRules(e.target.checked);
            if (e.target.checked) applyTemplateDefaults(builtinId);
          }}
        />
        Customize rules for this tournament
      </label>
      {customizeRules && config && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <Field label="Starting score">
            <input
              type="number"
              value={startingScore}
              onChange={(e) => setStartingScore(e.target.value)}
              style={input}
            />
          </Field>
          <Field label="Wicket penalty">
            <input
              type="number"
              value={wicketPenalty}
              onChange={(e) => setWicketPenalty(e.target.value)}
              style={input}
            />
          </Field>
          <Field label="Players per side (default)">
            <input
              type="number"
              value={playersDefault}
              onChange={(e) => setPlayersDefault(e.target.value)}
              style={input}
            />
          </Field>
          <Field label="Wide runs">
            <input
              type="number"
              value={wideRuns}
              onChange={(e) => setWideRuns(e.target.value)}
              style={input}
            />
          </Field>
          <Field label="No-ball runs">
            <input
              type="number"
              value={noBallRuns}
              onChange={(e) => setNoBallRuns(e.target.value)}
              style={input}
            />
          </Field>
          <Field label="Wide: rebowl the ball?">
            <select
              value={wideRebowl}
              onChange={(e) => setWideRebowl(e.target.value)}
              style={input}
            >
              <option value="false">No — ball counts, no extra delivery</option>
              <option value="true">Yes — rebowl (extra ball)</option>
            </select>
          </Field>
          <Field label="No-ball: rebowl the ball?">
            <select
              value={noBallRebowl}
              onChange={(e) => setNoBallRebowl(e.target.value)}
              style={input}
            >
              <option value="false">No — ball counts, no extra delivery</option>
              <option value="true">Yes — rebowl (extra ball)</option>
            </select>
          </Field>
        </div>
      )}
      {error && <p style={{ color: "var(--red)", marginBottom: 12 }}>{error}</p>}
      <button type="submit" disabled={busy} style={btn}>
        Create tournament
      </button>
    </form>
  );
}

export function AddTournamentTeamForm({
  tournamentId,
  teams,
}: {
  tournamentId: string;
  teams: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [name, setName] = useState("");
  const { run, error, busy } = useSubmit();

  return (
    <form
      style={card}
      onSubmit={(e) => {
        e.preventDefault();
        const body = name.trim()
          ? { name: name.trim() }
          : teamId
            ? { teamId }
            : null;
        if (!body) return;
        void run(`/api/v1/tournaments/${tournamentId}/teams`, body).then((ok) => {
          if (ok) {
            setName("");
            router.refresh();
          }
        });
      }}
    >
      <Field label="Team name (opponent or guest)">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Hayes U9"
          style={input}
        />
      </Field>
      {teams.length > 0 && (
        <Field label="Or pick from your club roster">
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            style={input}
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      {error && <p style={{ color: "var(--red)", marginBottom: 12 }}>{error}</p>}
      <button type="submit" disabled={busy || (!name.trim() && !teamId)} style={btn}>
        Add to tournament
      </button>
    </form>
  );
}

function todayDateInputValue(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function scheduleTeamNamesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function defaultAwayTeamName(
  tournamentTeams: { name: string }[],
  homeName: string,
): string {
  const other = tournamentTeams.find((t) => !scheduleTeamNamesMatch(t.name, homeName));
  return other?.name ?? "";
}

function uniqueTeamNameSuggestions(names: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of names) {
    const key = name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

export function CreateMatchForm({
  tournamentId,
  tournamentTeams,
}: {
  tournamentId: string;
  tournamentTeams: { id: string; name: string }[];
}) {
  const router = useRouter();
  const initialHome = tournamentTeams[0]?.name ?? "";
  const [homeTeamName, setHomeTeamName] = useState(initialHome);
  const [awayTeamName, setAwayTeamName] = useState(() =>
    defaultAwayTeamName(tournamentTeams, initialHome),
  );
  const [scheduledDate, setScheduledDate] = useState(todayDateInputValue);
  const [venue, setVenue] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const { run, error, busy } = useSubmit<{ id: string }>();

  useEffect(() => {
    if (tournamentTeams.length === 0) return;
    setHomeTeamName((prevHome) => {
      const home = prevHome || tournamentTeams[0]!.name;
      setAwayTeamName((prevAway) =>
        prevAway && !scheduleTeamNamesMatch(prevAway, home)
          ? prevAway
          : defaultAwayTeamName(tournamentTeams, home),
      );
      return home;
    });
  }, [tournamentTeams]);

  const displayError = localError ?? error;
  const teamSuggestions = uniqueTeamNameSuggestions(
    tournamentTeams.map((t) => t.name),
  );

  return (
    <form
      style={card}
      onSubmit={(e) => {
        e.preventDefault();
        const home = homeTeamName.trim();
        const away = awayTeamName.trim();
        if (!home || !away) {
          setLocalError("Enter home and away team names");
          return;
        }
        if (home.toLowerCase() === away.toLowerCase()) {
          setLocalError("Home and away teams must be different");
          return;
        }
        setLocalError(null);
        void run(`/api/v1/tournaments/${tournamentId}/matches`, {
          homeTeamName: home,
          awayTeamName: away,
          scheduledAt: scheduledDate
            ? new Date(scheduledDate).toISOString()
            : undefined,
          venue: venue || undefined,
          playersPerSide: 8,
          isOfficial: true,
        }).then((ok) => {
          if (ok) {
            setVenue("");
            setScheduledDate(todayDateInputValue());
            setAwayTeamName((prevAway) =>
              scheduleTeamNamesMatch(prevAway, homeTeamName)
                ? defaultAwayTeamName(tournamentTeams, homeTeamName)
                : prevAway,
            );
            router.refresh();
          }
        });
      }}
    >
      <Field label="Home team">
        <input
          required
          list="tournament-team-names"
          value={homeTeamName}
          onChange={(e) => {
            const nextHome = e.target.value;
            setHomeTeamName(nextHome);
            setAwayTeamName((prevAway) =>
              scheduleTeamNamesMatch(prevAway, nextHome)
                ? defaultAwayTeamName(tournamentTeams, nextHome)
                : prevAway,
            );
          }}
          placeholder="Your club team"
          style={input}
        />
      </Field>
      <Field label="Away team">
        <input
          required
          list="tournament-team-names"
          value={awayTeamName}
          onChange={(e) => setAwayTeamName(e.target.value)}
          placeholder="Opponent (name only is fine)"
          style={input}
        />
      </Field>
      <datalist id="tournament-team-names">
        {teamSuggestions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <Field label="Venue">
        <input value={venue} onChange={(e) => setVenue(e.target.value)} style={input} />
      </Field>
      <Field label="Match date">
        <input
          type="date"
          required
          value={scheduledDate}
          onChange={(e) => setScheduledDate(e.target.value)}
          style={input}
        />
      </Field>
      {displayError && (
        <p style={{ color: "var(--red)", marginBottom: 12 }}>{displayError}</p>
      )}
      <button
        type="submit"
        disabled={busy || !homeTeamName.trim() || !awayTeamName.trim() || !scheduledDate}
        style={btn}
      >
        Schedule match
      </button>
    </form>
  );
}

export function EditPlayerForm({
  teamId,
  playerId,
  initialLegalName,
  initialDisplayName,
  initialDateOfBirth,
  initialShirtNumber,
  onDone,
}: {
  teamId: string;
  playerId: string;
  initialLegalName: string;
  initialDisplayName: string | null;
  initialDateOfBirth: string;
  initialShirtNumber: number | null;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [legalName, setLegalName] = useState(initialLegalName);
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(initialDateOfBirth);
  const [shirtNumber, setShirtNumber] = useState(
    initialShirtNumber != null ? String(initialShirtNumber) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/teams/${teamId}/players/${playerId}`, {
        method: "PATCH",
        body: JSON.stringify({
          legalName,
          displayName: displayName.trim() || null,
          dateOfBirth: dateOfBirth
            ? new Date(dateOfBirth).toISOString()
            : null,
          shirtNumber: shirtNumber ? Number(shirtNumber) : null,
        }),
      });
      router.refresh();
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save player");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      style={{
        ...card,
        marginTop: 0,
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        borderTop: "1px solid #eee",
      }}
      onSubmit={save}
    >
      <Field label="Player name">
        <input
          required
          value={legalName}
          onChange={(e) => setLegalName(e.target.value)}
          style={input}
        />
      </Field>
      <Field label="Display name (optional)">
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          style={input}
        />
      </Field>
      <Field label="Date of birth">
        <input
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          style={input}
        />
      </Field>
      <Field label="Shirt number">
        <input
          type="number"
          min={0}
          max={99}
          value={shirtNumber}
          onChange={(e) => setShirtNumber(e.target.value)}
          style={input}
        />
      </Field>
      {error && <p style={{ color: "var(--red)", marginBottom: 12 }}>{error}</p>}
      <div style={{ display: "flex", gap: 12 }}>
        <button type="submit" disabled={busy} style={btn}>
          Save player
        </button>
        {onDone && (
          <button
            type="button"
            disabled={busy}
            onClick={onDone}
            style={{ ...btn, background: "transparent", color: "var(--md)", border: "1px solid #ccc" }}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export function TeamDeleteAction({
  orgId,
  teamId,
  teamName,
  compact = false,
}: {
  orgId: string;
  teamId: string;
  teamName: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/teams/${teamId}`, { method: "DELETE" });
      setConfirmDelete(false);
      router.push(`/dashboard/organizations/${orgId}/teams`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete team");
      setConfirmDelete(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {error && <p style={{ color: "var(--red)", marginBottom: 12 }}>{error}</p>}
      {!confirmDelete ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => setConfirmDelete(true)}
          className="btn btn-secondary btn-nav"
          aria-label={`Delete ${teamName}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            borderRadius: 9999,
            padding: compact ? "8px 12px" : "9px 14px",
            fontSize: compact ? "0.85rem" : "0.9rem",
            fontWeight: 700,
          }}
        >
          <span aria-hidden>🗑</span>
          Delete
        </button>
      ) : (
        <div
          style={{
            marginTop: 10,
            border: "1px solid #f0c2c2",
            background: "#fff5f5",
            borderRadius: 10,
            padding: 10,
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span style={{ color: "#7a1f1f", fontSize: "0.9rem" }}>
            Delete "{teamName}"? This cannot be undone.
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void remove()}
            style={{ ...btn, background: "var(--red)", padding: "8px 14px" }}
            aria-label={`Confirm delete ${teamName}`}
          >
            Confirm delete
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmDelete(false)}
            style={{ ...btn, padding: "8px 14px" }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

export function EditTeamForm({
  orgId,
  teamId,
  initialName,
  initialAgeGroup,
}: {
  orgId: string;
  teamId: string;
  initialName: string;
  initialAgeGroup: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [ageGroup, setAgeGroup] = useState(initialAgeGroup ?? "U9");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/teams/${teamId}`, {
        method: "PATCH",
        body: JSON.stringify({ name, ageGroup }),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save team");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form style={card} onSubmit={save}>
      <Field label="Team name">
        <input required value={name} onChange={(e) => setName(e.target.value)} style={input} />
      </Field>
      <Field label="Age group">
        <AgeGroupSelect value={ageGroup} onChange={setAgeGroup} style={input} />
      </Field>
      {error && <p style={{ color: "var(--red)", marginBottom: 12 }}>{error}</p>}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <button type="submit" disabled={busy} style={btn}>
          Save changes
        </button>
        <TeamDeleteAction orgId={orgId} teamId={teamId} teamName={name || initialName} />
      </div>
    </form>
  );
}

function CopyInviteLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* fallback: select via prompt is worse UX; link remains clickable */
    }
  }

  return (
    <div
      style={{
        marginBottom: 16,
        padding: 12,
        background: "#e8f5e9",
        border: "1px solid #a5d6a7",
        borderRadius: 8,
        fontSize: "0.9rem",
      }}
    >
      <p style={{ margin: "0 0 8px", fontWeight: 600, color: "#2e7d32" }}>
        Invite created — share this link
      </p>
      <p style={{ margin: "0 0 8px", color: "#555", fontSize: "0.85rem" }}>
        No email is sent in local dev unless Resend is configured. Copy the link
        and open it in a browser (or incognito) as the invited manager.
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <code
          style={{
            flex: 1,
            minWidth: 0,
            wordBreak: "break-all",
            fontSize: "0.82rem",
            background: "#fff",
            padding: "6px 8px",
            borderRadius: 4,
          }}
        >
          {url}
        </code>
        <button
          type="button"
          onClick={() => void copy()}
          style={{ ...btn, padding: "8px 14px", fontSize: "0.85rem", whiteSpace: "nowrap" }}
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
    </div>
  );
}

export function InviteForm({
  tournamentId,
  teams,
}: {
  tournamentId: string;
  teams: { id: string; name: string }[];
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"MANAGER" | "SCORER">("MANAGER");
  const [teamId, setTeamId] = useState("");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const { run, error, busy } = useSubmit<{ token: string }>();

  return (
    <form
      style={card}
      onSubmit={(e) => {
        e.preventDefault();
        void run(`/api/v1/tournaments/${tournamentId}/invites`, {
          email,
          kind: role === "MANAGER" ? "MANAGER" : "ORG_MANAGER",
          role: role === "SCORER" ? "SCORER" : undefined,
          teamId: teamId || undefined,
        }).then((invite) => {
          if (invite?.token) {
            setInviteUrl(`${window.location.origin}/invite/${invite.token}`);
            setEmail("");
          }
        });
      }}
    >
      <Field label="Manager email">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={input}
        />
      </Field>
      <Field label="Role">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "MANAGER" | "SCORER")}
          style={input}
        >
          <option value="MANAGER">Manager — run this tournament</option>
          <option value="SCORER">Scorer — score matches for the club</option>
        </select>
      </Field>
      {teams.length > 0 && (
        <Field label="Team (optional)">
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)} style={input}>
            <option value="">— Any —</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      {error && <p style={{ color: "var(--red)", marginBottom: 12 }}>{error}</p>}
      {inviteUrl && <CopyInviteLink url={inviteUrl} />}
      <button type="submit" disabled={busy} style={btn}>
        {inviteUrl ? "Create another invite" : "Create invite"}
      </button>
    </form>
  );
}

export function RedeemCouponForm({
  tournamentId,
  onRedeemed,
}: {
  tournamentId: string;
  onRedeemed?: (balancePence: number, amountPence: number) => void;
}) {
  const [code, setCode] = useState("");
  const { run, error, busy } = useSubmit<{
    balancePence: number;
    amountPence: number;
  }>();

  return (
    <form
      style={card}
      onSubmit={(e) => {
        e.preventDefault();
        void run(
          `/api/v1/tournaments/${tournamentId}/wallet/redeem-coupon`,
          { code: code.trim() },
        ).then((data) => {
          if (data) {
            setCode("");
            onRedeemed?.(data.balancePence, data.amountPence);
          }
        });
      }}
    >
      <Field label="Coupon code">
        <input
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="HOWZZAT-ALPHA-XXXX"
          style={input}
          autoComplete="off"
          spellCheck={false}
        />
      </Field>
      {error && <p style={{ color: "var(--red)", marginBottom: 12 }}>{error}</p>}
      <button type="submit" disabled={busy || !code.trim()} style={btn}>
        {busy ? "Redeeming…" : "Redeem coupon"}
      </button>
    </form>
  );
}

export function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/invites/${token}/accept`, { method: "POST" });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept invite");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {error && <p style={{ color: "var(--red)", marginBottom: 12 }}>{error}</p>}
      <button type="button" onClick={accept} disabled={busy} style={btn}>
        {busy ? "Accepting…" : "Accept invite"}
      </button>
    </div>
  );
}
