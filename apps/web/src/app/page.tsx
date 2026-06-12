import Link from "next/link";
import {
  getBuiltinProfile,
  listBuiltinProfiles,
} from "@howzzat/rules-engine";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const profiles = listBuiltinProfiles();
  const u9 = getBuiltinProfile("u9-softball-london-v1");
  const demoMatch = await prisma.match.findFirst({
    where: { publicSlug: "demo-score" },
    select: { id: true },
  });

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1rem" }}>
      <header
        style={{
          background: "linear-gradient(135deg, var(--dk), var(--md))",
          color: "#fff",
          padding: "2rem",
          borderRadius: 12,
          marginBottom: "2rem",
        }}
      >
        <h1 style={{ fontSize: "2rem", fontWeight: 800 }}>Howzzat</h1>
        <p style={{ marginTop: 8, opacity: 0.9 }}>
          Cricket Scoring — rules-aware stats, live scorecards, and public dashboards.
        </p>
      </header>

      <section
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: "1.5rem",
          marginBottom: "1rem",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
      >
        <h2 style={{ color: "var(--dk)", marginBottom: 12 }}>Who it&apos;s for</h2>
        <ul style={{ listStyle: "none", fontSize: "0.95rem", color: "#444" }}>
          <li style={{ padding: "6px 0" }}>
            <strong>Managers</strong> — tournaments, squads, and fixtures
          </li>
          <li style={{ padding: "6px 0" }}>
            <strong>Scorers</strong> — live ball-by-ball on web or mobile
          </li>
          <li style={{ padding: "6px 0" }}>
            <strong>Spectators</strong> — live and post-match scorecards via public link (no
            account)
          </li>
        </ul>
      </section>

      <section
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: "1.5rem",
          marginBottom: "1rem",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
      >
        <h2 style={{ color: "var(--dk)", marginBottom: 12 }}>Built-in rules profiles</h2>
        <ul style={{ listStyle: "none" }}>
          {profiles.map((p) => (
            <li key={p.id} style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>
              <strong>{p.name}</strong>
              <br />
              <span style={{ fontSize: "0.9rem", color: "#666" }}>{p.description}</span>
            </li>
          ))}
        </ul>
        {u9 && (
          <p style={{ marginTop: 12, fontSize: "0.85rem", color: "#666" }}>
            Starting score: {u9.startingScore} · Wicket penalty: −{u9.wicketPenalty} ·{" "}
            {u9.playersPerSide.min}–{u9.playersPerSide.max} players
          </p>
        )}
      </section>

      <section
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: "1.5rem",
          marginBottom: "1rem",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
      >
        <h2 style={{ color: "var(--dk)", marginBottom: 12 }}>Try it</h2>
        <p style={{ marginBottom: 8 }}>
          <Link href="/login">Club dashboard</Link>
          {" · "}
          <Link href="/orgs/edgware-cc/tournaments/u9-2026">Public tournament</Link>
          {" · "}
          <Link href="/demo/scorecard">Scorecard demo</Link>
          {" · "}
          <Link href="/demo/simulated">Simulated match</Link>
          {demoMatch && (
            <>
              {" · "}
              <Link href={`/match/${demoMatch.id}/score`}>U9 full squad scorer</Link>
            </>
          )}
          {" · "}
          <Link href="/demo/u9-score">U9 4-over demo</Link>
        </p>
        <p style={{ marginTop: 12, fontSize: "0.85rem", color: "#666" }}>
          Reset U9 demo: <code>POST /api/v1/demo/u9-match</code> — pick 2–11 from 10 per
          side, 4 overs each, 200 start, −5 per wicket.
        </p>
      </section>

      <section
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: "1.5rem",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
      >
        <h2 style={{ color: "var(--dk)", marginBottom: 12 }}>Developers</h2>
        <p style={{ marginBottom: 8 }}>
          <Link href="/demo/scorecard">Scorecard demo (Edgware M4)</Link> ·{" "}
          <Link href="/api/health">API health</Link> ·{" "}
          <Link href="/api/v1/organizations">Organizations API</Link> ·{" "}
          <Link href="/api/v1/rules/profiles">Rules profiles</Link>
        </p>
        <p style={{ fontSize: "0.85rem", color: "#666" }}>
          Full REST docs: <code>docs/api.md</code> in the repo
        </p>
      </section>
    </main>
  );
}
