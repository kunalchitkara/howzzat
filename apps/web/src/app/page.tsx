import Image from "next/image";
import { getServerUser } from "@/lib/auth/server";
import { BtnLink } from "@/components/dashboard/ui";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getServerUser();

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
          Rules-aware stats, live scorecards, and public dashboards for clubs and
          tournaments.
        </p>
        <div className="btn-group" style={{ marginTop: 20 }}>
          {user ? (
            <>
              <BtnLink href="/dashboard">Club dashboard</BtnLink>
              <BtnLink href="/dashboard/account" variant="secondary">
                Account
              </BtnLink>
            </>
          ) : (
            <>
              <BtnLink href="/login">Sign in</BtnLink>
              <BtnLink href="/login" variant="secondary">
                Create a club
              </BtnLink>
            </>
          )}
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
            <strong>Managers</strong> — set up tournaments, squads, and fixtures in one
            place
          </li>
          <li style={{ padding: "6px 0" }}>
            <strong>Scorers</strong> — ball-by-ball scoring on web or mobile, with rules
            built in
          </li>
          <li style={{ padding: "6px 0" }}>
            <strong>Spectators</strong> — follow live and post-match scorecards via a
            public link (no account needed)
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
        <h2 style={{ color: "var(--dk)", marginBottom: 12 }}>What you get</h2>
        <ul style={{ listStyle: "none", fontSize: "0.95rem", color: "#444" }}>
          <li style={{ padding: "6px 0" }}>
            Tournament and team management with age-group rules profiles
          </li>
          <li style={{ padding: "6px 0" }}>
            Live scoring with squad confirmation, toss, and chase support
          </li>
          <li style={{ padding: "6px 0" }}>
            Public scorecards and tournament pages for parents and supporters
          </li>
        </ul>
      </section>

      {!user && (
        <section
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: "1.5rem",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <h2 style={{ color: "var(--dk)", marginBottom: 12 }}>Get started</h2>
          <p style={{ fontSize: "0.95rem", color: "#444", marginBottom: 16 }}>
            Sign in to create your club, schedule fixtures, and share live scorecards.
          </p>
          <div className="btn-group">
            <BtnLink href="/login">Sign in or sign up</BtnLink>
            <BtnLink href="/demo/u9-score" variant="secondary">
              Open U9 scoring demo
            </BtnLink>
          </div>
        </section>
      )}
    </main>
  );
}
