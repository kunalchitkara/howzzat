"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/client/api";
import { btn, card, Field, input } from "./ui";

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
  const [name, setName] = useState("");
  const { run, error, busy } = useSubmit<{ id: string }>();

  return (
    <form
      style={card}
      onSubmit={(e) => {
        e.preventDefault();
        void run("/api/v1/organizations", { name }, "/dashboard");
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
        <input value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} style={input} />
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

function formatOversSummary(
  config: NonNullable<RulesTemplateOption["latestVersion"]>["config"],
) {
  if (!config) return "";
  const formula = config.oversPerInnings?.formula;
  if (formula?.startsWith("fixed:")) {
    return `${formula.slice("fixed:".length)} overs/side`;
  }
  if (formula === "2 * playersPerSide") {
    const def = config.playersPerSide?.default;
    if (def != null) return `${2 * def} overs/side (${def} players)`;
    return "2× squad size overs/side";
  }
  return "";
}

function templateOptionLabel(t: RulesTemplateOption): string {
  const cfg = t.latestVersion?.config;
  const overs = formatOversSummary(cfg);
  if (overs) return `${t.name} — ${overs}`;
  return t.name;
}

function groupTemplates(templates: RulesTemplateOption[]) {
  const mjca = templates.filter((t) => t.builtinId?.startsWith("mjca-"));
  const demo = templates.filter((t) => t.builtinId?.startsWith("demo-"));
  const other = templates.filter(
    (t) =>
      !t.builtinId?.startsWith("mjca-") && !t.builtinId?.startsWith("demo-"),
  );
  return { mjca, demo, other };
}

export function CreateTournamentForm({
  orgId,
  templates,
}: {
  orgId: string;
  templates: RulesTemplateOption[];
}) {
  const defaultBuiltin =
    templates.find((t) => t.builtinId === "mjca-u9-outdoor-v1")?.builtinId ??
    templates.find((t) => t.builtinId === "u9-softball-london-v1")?.builtinId ??
    templates[0]?.builtinId ??
    "u9-softball-london-v1";

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

  const selected = templates.find((t) => t.builtinId === builtinId);
  const config = selected?.latestVersion?.config;
  const { mjca, demo, other } = groupTemplates(templates);

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
        <input value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} style={input} />
      </Field>
      <Field label="Season">
        <input
          value={seasonLabel}
          onChange={(e) => setSeasonLabel(e.target.value)}
          style={input}
        />
      </Field>
      <Field label="Rules template">
        <select
          value={builtinId}
          onChange={(e) => {
            setBuiltinId(e.target.value);
            applyTemplateDefaults(e.target.value);
          }}
          style={input}
        >
          {mjca.length > 0 && (
            <optgroup label="MJCA (Middlesex / London)">
              {mjca.map((t) => (
                <option key={t.builtinId!} value={t.builtinId!}>
                  {templateOptionLabel(t)}
                </option>
              ))}
            </optgroup>
          )}
          {demo.length > 0 && (
            <optgroup label="Demo">
              {demo.map((t) => (
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
      </Field>
      {config && (
        <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: 12 }}>
          {selected?.description ?? config.description}
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
  const { run, error, busy } = useSubmit();

  if (teams.length === 0) {
    return (
      <p style={{ color: "#666", fontSize: "0.9rem" }}>
        Create teams in your organization first, then add them to this tournament.
      </p>
    );
  }

  return (
    <form
      style={card}
      onSubmit={(e) => {
        e.preventDefault();
        void run(`/api/v1/tournaments/${tournamentId}/teams`, { teamId }).then((ok) => {
          if (ok) router.refresh();
        });
      }}
    >
      <Field label="Team">
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
      {error && <p style={{ color: "var(--red)", marginBottom: 12 }}>{error}</p>}
      <button type="submit" disabled={busy} style={btn}>
        Add to tournament
      </button>
    </form>
  );
}

export function CreateMatchForm({
  tournamentId,
  tournamentTeams,
}: {
  tournamentId: string;
  tournamentTeams: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [homeTeamId, setHomeTeamId] = useState(tournamentTeams[0]?.id ?? "");
  const [awayTeamId, setAwayTeamId] = useState(tournamentTeams[1]?.id ?? "");
  const [venue, setVenue] = useState("");
  const { run, error, busy } = useSubmit<{ id: string }>();

  if (tournamentTeams.length < 2) {
    return (
      <p style={{ color: "#666", fontSize: "0.9rem" }}>
        Add at least two teams to schedule a fixture.
      </p>
    );
  }

  return (
    <form
      style={card}
      onSubmit={(e) => {
        e.preventDefault();
        void run(`/api/v1/tournaments/${tournamentId}/matches`, {
          homeTeamId,
          awayTeamId,
          venue: venue || undefined,
          playersPerSide: 8,
          isOfficial: true,
        }).then((ok) => {
          if (ok) {
            setVenue("");
            router.refresh();
          }
        });
      }}
    >
      <Field label="Home team">
        <select
          value={homeTeamId}
          onChange={(e) => setHomeTeamId(e.target.value)}
          style={input}
        >
          {tournamentTeams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Away team">
        <select
          value={awayTeamId}
          onChange={(e) => setAwayTeamId(e.target.value)}
          style={input}
        >
          {tournamentTeams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Venue">
        <input value={venue} onChange={(e) => setVenue(e.target.value)} style={input} />
      </Field>
      {error && <p style={{ color: "var(--red)", marginBottom: 12 }}>{error}</p>}
      <button type="submit" disabled={busy} style={btn}>
        Schedule match
      </button>
    </form>
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
  const [inviteKind, setInviteKind] = useState<"MANAGER" | "ORG_MANAGER">(
    "MANAGER",
  );
  const [orgRole, setOrgRole] = useState("SCORER");
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
          kind: inviteKind,
          role: inviteKind === "ORG_MANAGER" ? orgRole : undefined,
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
      <Field label="Invite type">
        <select
          value={inviteKind}
          onChange={(e) =>
            setInviteKind(e.target.value as "MANAGER" | "ORG_MANAGER")
          }
          style={input}
        >
          <option value="MANAGER">Tournament manager (this tournament only)</option>
          <option value="ORG_MANAGER">Organization member (club-wide access)</option>
        </select>
      </Field>
      {inviteKind === "ORG_MANAGER" && (
        <Field label="Organization role">
          <select value={orgRole} onChange={(e) => setOrgRole(e.target.value)} style={input}>
            <option value="MANAGER">Manager</option>
            <option value="SCORER">Scorer</option>
            <option value="VIEWER">Viewer</option>
          </select>
        </Field>
      )}
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
      {inviteUrl && (
        <p style={{ marginBottom: 12, fontSize: "0.9rem", wordBreak: "break-all" }}>
          Invite link:{" "}
          <a href={inviteUrl}>{inviteUrl}</a>
        </p>
      )}
      <button type="submit" disabled={busy} style={btn}>
        Send invite
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
