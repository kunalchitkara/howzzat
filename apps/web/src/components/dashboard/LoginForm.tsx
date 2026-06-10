"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/client/api";
import { btn, card, Field, input } from "./ui";

export function LoginForm({ redirectTo = "/dashboard" }: { redirectTo?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email,
          name: name.trim() || undefined,
        }),
      });
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={card}>
      <p style={{ marginBottom: 16, color: "#666", fontSize: "0.95rem" }}>
        Enter your email to sign in. We create an account on first visit — no password
        needed for the demo.
      </p>
      <Field label="Email">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={input}
          placeholder="you@club.org"
        />
      </Field>
      <Field label="Name (optional)">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={input}
          placeholder="Your name"
        />
      </Field>
      {error && <p style={{ color: "var(--red)", marginBottom: 12 }}>{error}</p>}
      <button type="submit" disabled={busy} style={btn}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
