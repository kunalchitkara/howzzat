import Image from "next/image";
import {
  getBuiltinProfile,
  listBuiltinProfiles,
} from "@howzzat/rules-engine";
import { prisma } from "@/lib/db";
import { matchPublicRef } from "@/lib/match-slug";
import { BtnLink } from "@/components/dashboard/ui";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const profiles = listBuiltinProfiles();
  const u9 = getBuiltinProfile("u9-softball-london-v1");
  const demoMatch = await prisma.match.findFirst({
    where: { publicSlug: "demo-score" },
    select: { id: true, slug: true },
  });

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1rem" }}>
      <header
        style={{
          background: "var(--brand-navy)",
          color: "#fff",
          padding: "2rem",
          borderRadius: 12,
          marginBottom: "2rem",
          borderBottom: "3px solid var(--brand-primary)",
        }}
      >
        <Image
          src="/logo-full.png"
          alt="Howzzat — Cricket Scoring App"
          width={300}
          height={90}
          priority
          style={{ height: "auto", maxWidth: "100%" }}
        />
        <p style={{ marginTop: 12, opacity: 0.9, color: "rgba(255,255,255,0.85)" }}>
          Rules-aware stats, live scorecards, and public dashboards.
        </p>
        <div className="btn-group" style={{ marginTop: 20 }}>
          <BtnLink href="/login">Sign in</BtnLink>
          <BtnLink href="/dashboard" variant="secondary">
            Club dashboard
          </BtnLink>
        </div>
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
        <div className="btn-group">
          <BtnLink href="/login">Club dashboard</BtnLink>
          <BtnLink href="/orgs/edgware-cc/tournaments/u9-2026" variant="secondary">
            Public tournament
          </BtnLink>
          <BtnLink href="/demo/scorecard" variant="secondary">
            Scorecard demo
          </BtnLink>
          <BtnLink href="/demo/simulated" variant="secondary">
            Simulated match
          </BtnLink>
          {demoMatch && (
            <BtnLink href={`/match/${matchPublicRef(demoMatch)}/score`} variant="secondary">
              U9 full squad scorer
            </BtnLink>
          )}
          <BtnLink href="/demo/u9-score" variant="secondary">
            U9 4-over demo
          </BtnLink>
        </div>
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
        <div className="btn-group">
          <BtnLink href="/demo/scorecard" variant="secondary">
            Scorecard demo (Edgware M4)
          </BtnLink>
          <BtnLink href="/api/health" variant="secondary">
            API health
          </BtnLink>
          <BtnLink href="/api/v1/organizations" variant="secondary">
            Organizations API
          </BtnLink>
          <BtnLink href="/api/v1/rules/profiles" variant="secondary">
            Rules profiles
          </BtnLink>
        </div>
        <p style={{ marginTop: 12, fontSize: "0.85rem", color: "#666" }}>
          Full REST docs: <code>docs/api.md</code> in the repo
        </p>
      </section>
    </main>
  );
}
