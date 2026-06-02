import Link from "next/link";
import {
  getBuiltinProfile,
  listBuiltinProfiles,
} from "@howzzat/rules-engine";

export default function HomePage() {
  const profiles = listBuiltinProfiles();
  const u9 = getBuiltinProfile("u9-softball-london-v1");

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
          Junior cricket scoring, rules-aware stats, and public dashboards.
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
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
      >
        <h2 style={{ color: "var(--dk)", marginBottom: 12 }}>Developers</h2>
        <p style={{ marginBottom: 8 }}>
          <Link href="/api/health">API health</Link> ·{" "}
          <Link href="/api/profiles">Rules profiles JSON</Link>
        </p>
        <p style={{ fontSize: "0.85rem", color: "#666" }}>
          Monorepo: <code>apps/web</code> (Next.js) · <code>apps/mobile</code> (Expo) ·{" "}
          <code>packages/rules-engine</code>
        </p>
      </section>
    </main>
  );
}
