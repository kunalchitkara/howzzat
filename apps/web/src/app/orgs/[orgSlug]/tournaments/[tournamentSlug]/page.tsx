import { notFound } from "next/navigation";
import { BtnLink } from "@/components/dashboard/ui";
import { getTournamentBySlug } from "@/lib/services/tournaments";
import { ApiError } from "@/lib/api/http";

export const dynamic = "force-dynamic";

export default async function PublicTournamentPage({
  params,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string }>;
}) {
  const { orgSlug, tournamentSlug } = await params;
  let tournament;
  try {
    tournament = await getTournamentBySlug(orgSlug, tournamentSlug);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const org = tournament.organization;

  return (
    <main style={{ background: "#eef2f7", minHeight: "100vh", paddingBottom: 32 }}>
      <header
        style={{
          background: "linear-gradient(135deg, var(--dk), var(--md))",
          color: "#fff",
          padding: "2rem 1rem",
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <p style={{ fontSize: "0.85rem", opacity: 0.9 }}>{org.name}</p>
          <h1 style={{ fontSize: "2rem", fontWeight: 800, marginTop: 4 }}>
            {tournament.name}
          </h1>
          <p style={{ marginTop: 8, opacity: 0.9 }}>
            {tournament.ageGroup} · {tournament.seasonLabel ?? "Season TBC"} ·{" "}
            {tournament.rulesProfileVersion?.template?.name ?? "Cricket"}
          </p>
        </div>
      </header>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "1.5rem 1rem" }}>
        <section
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: "1.25rem",
            marginBottom: "1rem",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <h2 style={{ color: "var(--dk)", marginBottom: 12 }}>Teams</h2>
          <ul style={{ listStyle: "none", display: "flex", flexWrap: "wrap", gap: 8 }}>
            {tournament.teams.map((tt) => (
              <li
                key={tt.id}
                style={{
                  background: "var(--lt)",
                  padding: "8px 14px",
                  borderRadius: 20,
                  fontWeight: 600,
                  fontSize: "0.9rem",
                }}
              >
                {tt.team.name}
              </li>
            ))}
          </ul>
        </section>

        <section
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: "1.25rem",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <h2 style={{ color: "var(--dk)", marginBottom: 12 }}>Fixtures & results</h2>
          {tournament.matches.length === 0 ? (
            <p style={{ color: "#666" }}>Fixtures will appear here once scheduled.</p>
          ) : (
            <ul style={{ listStyle: "none" }}>
              {tournament.matches.map((m) => (
                <li
                  key={m.id}
                  style={{
                    padding: "14px 0",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <div>
                      <strong>
                        {m.homeTeam.team.name} vs {m.awayTeam.team.name}
                      </strong>
                      <p style={{ fontSize: "0.85rem", color: "#666", marginTop: 4 }}>
                        {m.status === "LIVE" && (
                          <span style={{ color: "var(--red)", fontWeight: 700 }}>● LIVE · </span>
                        )}
                        {m.homeScore != null && m.awayScore != null
                          ? `${m.homeScore} – ${m.awayScore}`
                          : m.status}
                        {m.marginText ? ` · ${m.marginText}` : ""}
                        {m.venue ? ` · ${m.venue}` : ""}
                      </p>
                    </div>
                    <BtnLink href={`/match/${m.id}`} className="btn-nav">
                      Scorecard
                    </BtnLink>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="btn-group" style={{ justifyContent: "center", marginTop: 24 }}>
          <BtnLink href="/" variant="secondary" className="btn-nav">
            Howzzat home
          </BtnLink>
          <BtnLink href="/login" className="btn-nav">
            Club login
          </BtnLink>
        </div>
      </div>
    </main>
  );
}
