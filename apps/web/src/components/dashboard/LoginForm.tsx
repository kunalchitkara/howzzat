"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/client/api";
import { btn, card, Field, input } from "./ui";

export function LoginForm({
  redirectTo = "/dashboard",
  initialError,
  setupHints,
}: {
  redirectTo?: string;
  initialError?: string | null;
  setupHints?: {
    googleRedirectUri: string;
    smsReady: boolean;
  };
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [smsStep, setSmsStep] = useState<"phone" | "code">("phone");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [busy, setBusy] = useState(false);

  const googleHref = `/api/v1/auth/google?redirect=${encodeURIComponent(redirectTo)}`;

  async function submitEmail(e: React.FormEvent) {
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

  async function sendSmsCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/v1/auth/sms/send", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
      setSmsStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send code");
    } finally {
      setBusy(false);
    }
  }

  async function verifySmsCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/v1/auth/sms/verify", {
        method: "POST",
        body: JSON.stringify({
          phone,
          code,
          name: name.trim() || undefined,
        }),
      });
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={card}>
      {setupHints && process.env.NODE_ENV === "development" && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            background: "#fff8e6",
            border: "1px solid #f0d78c",
            borderRadius: 8,
            fontSize: "0.82rem",
            color: "#5c4a00",
            lineHeight: 1.5,
          }}
        >
          <strong>Dev setup</strong>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
            <li>
              <strong>Google:</strong> add this redirect URI in Google Cloud →
              Credentials → Web client:
              <code style={{ display: "block", marginTop: 4, wordBreak: "break-all" }}>
                {setupHints.googleRedirectUri}
              </code>
            </li>
            {!setupHints.smsReady && (
              <li>
                <strong>SMS:</strong> set <code>TWILIO_AUTH_TOKEN</code> in{" "}
                <code>apps/web/.env.local</code> and restart the server.
              </li>
            )}
          </ul>
        </div>
      )}
      <a
        href={googleHref}
        style={{
          ...btn,
          display: "block",
          textAlign: "center",
          textDecoration: "none",
          marginBottom: 16,
          background: "#fff",
          color: "#333",
          border: "1px solid #dadce0",
        }}
      >
        Continue with Google
      </a>

      <form onSubmit={smsStep === "phone" ? sendSmsCode : verifySmsCode} style={{ marginBottom: 20 }}>
        <p style={{ marginBottom: 12, color: "#666", fontSize: "0.95rem" }}>
          {smsStep === "phone"
            ? "Or sign in with your UK mobile — we’ll text a one-time code."
            : `Enter the code we sent to ${phone}.`}
        </p>
        {smsStep === "phone" ? (
          <Field label="UK mobile">
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={input}
              placeholder="07xxx xxxxxx"
              autoComplete="tel"
            />
          </Field>
        ) : (
          <>
            <Field label="Verification code">
              <input
                type="text"
                required
                inputMode="numeric"
                pattern="\d{4,8}"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                style={input}
                placeholder="123456"
                autoComplete="one-time-code"
              />
            </Field>
            <Field label="Name (optional, first time only)">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={input}
                placeholder="Your name"
              />
            </Field>
            <button
              type="button"
              onClick={() => {
                setSmsStep("phone");
                setCode("");
              }}
              style={{
                background: "none",
                border: "none",
                color: "var(--md)",
                cursor: "pointer",
                fontSize: "0.85rem",
                marginBottom: 12,
                padding: 0,
              }}
            >
              ← Use a different number
            </button>
          </>
        )}
        {error && <p style={{ color: "var(--red)", marginBottom: 12 }}>{error}</p>}
        <button type="submit" disabled={busy} style={btn}>
          {busy
            ? "Please wait…"
            : smsStep === "phone"
              ? "Send code"
              : "Verify & sign in"}
        </button>
      </form>

      <details style={{ fontSize: "0.9rem", color: "#666" }}>
        <summary style={{ cursor: "pointer", marginBottom: 8 }}>Demo email sign-in</summary>
        <form onSubmit={submitEmail}>
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
          <button type="submit" disabled={busy} style={{ ...btn, marginTop: 8 }}>
            {busy ? "Signing in…" : "Sign in with email"}
          </button>
        </form>
      </details>
    </div>
  );
}
