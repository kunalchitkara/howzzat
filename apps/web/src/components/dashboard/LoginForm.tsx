"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/client/api";
import { card, Field, input } from "./ui";

type AuthTab = "google" | "email-code" | "email-password";

export function LoginForm({
  redirectTo = "/dashboard",
  initialError,
  setupHints,
}: {
  redirectTo?: string;
  initialError?: string | null;
  setupHints?: {
    googleRedirectUri: string;
    emailOtpReady: boolean;
    smsReady: boolean;
  };
}) {
  const router = useRouter();
  const [tab, setTab] = useState<AuthTab>("email-code");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [emailOtpStep, setEmailOtpStep] = useState<"email" | "code">("email");
  const [smsStep, setSmsStep] = useState<"phone" | "code">("phone");
  const [passwordMode, setPasswordMode] = useState<"sign-in" | "register">("sign-in");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [busy, setBusy] = useState(false);

  const googleHref = `/api/v1/auth/google?redirect=${encodeURIComponent(redirectTo)}`;

  async function sendEmailCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/v1/auth/email/send", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setEmailOtpStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send code");
    } finally {
      setBusy(false);
    }
  }

  async function verifyEmailCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/v1/auth/email/verify", {
        method: "POST",
        body: JSON.stringify({
          email,
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

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const path =
        passwordMode === "register"
          ? "/api/v1/auth/register"
          : "/api/v1/auth/login/password";
      await apiFetch(path, {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          name: passwordMode === "register" ? name.trim() || undefined : undefined,
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

  const tabClass = (active: boolean) =>
    `btn btn-nav ${active ? "btn-primary" : "btn-secondary"}`;

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
            {!setupHints.emailOtpReady && (
              <li>
                <strong>Email code:</strong> set <code>RESEND_API_KEY</code> and{" "}
                <code>EMAIL_FROM</code> in <code>apps/web/.env.local</code>, or use{" "}
                <code>DEV_EMAIL_BYPASS_EMAIL</code> / <code>DEV_EMAIL_BYPASS_CODE</code>.
              </li>
            )}
          </ul>
        </div>
      )}

      <p style={{ marginBottom: 16, color: "#444", fontSize: "0.95rem", textAlign: "center" }}>
        Sign in to Cricket Scoring — manage tournaments, squads, and live scores.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button
          type="button"
          className={tabClass(tab === "google")}
          style={{ flex: 1 }}
          onClick={() => setTab("google")}
        >
          Google
        </button>
        <button
          type="button"
          className={tabClass(tab === "email-code")}
          style={{ flex: 1 }}
          onClick={() => setTab("email-code")}
        >
          Email code
        </button>
        <button
          type="button"
          className={tabClass(tab === "email-password")}
          style={{ flex: 1 }}
          onClick={() => setTab("email-password")}
        >
          Password
        </button>
      </div>

      {tab === "google" && (
        <div>
          <a href={googleHref} className="btn btn-secondary" style={{ display: "block", textAlign: "center" }}>
            Continue with Google
          </a>
        </div>
      )}

      {tab === "email-code" && (
        <form onSubmit={emailOtpStep === "email" ? sendEmailCode : verifyEmailCode}>
          <p style={{ marginBottom: 12, color: "#666", fontSize: "0.95rem" }}>
            {emailOtpStep === "email"
              ? "We'll email a one-time 6-digit code to sign you in."
              : `Enter the code we sent to ${email}.`}
          </p>
          {emailOtpStep === "email" ? (
            <Field label="Email">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={input}
                placeholder="you@club.org"
                autoComplete="email"
              />
            </Field>
          ) : (
            <>
              <Field label="Verification code">
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
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
                className="btn btn-secondary btn-nav"
                onClick={() => {
                  setEmailOtpStep("email");
                  setCode("");
                }}
                style={{ marginBottom: 12 }}
              >
                ← Different email
              </button>
            </>
          )}
          {error && <p style={{ color: "var(--red)", marginBottom: 12 }}>{error}</p>}
          <button type="submit" disabled={busy} className="btn btn-primary">
            {busy
              ? "Please wait…"
              : emailOtpStep === "email"
                ? "Send code"
                : "Verify & sign in"}
          </button>
        </form>
      )}

      {tab === "email-password" && (
        <form onSubmit={submitPassword}>
          <p style={{ marginBottom: 12, color: "#666", fontSize: "0.95rem" }}>
            {passwordMode === "sign-in"
              ? "Sign in with your email and password."
              : "Create an account with email and password."}
          </p>
          <Field label="Email">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={input}
              placeholder="you@club.org"
              autoComplete="email"
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={input}
              placeholder={passwordMode === "register" ? "At least 8 characters" : "Your password"}
              autoComplete={
                passwordMode === "register" ? "new-password" : "current-password"
              }
            />
          </Field>
          {passwordMode === "register" && (
            <Field label="Name (optional)">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={input}
                placeholder="Your name"
              />
            </Field>
          )}
          {error && <p style={{ color: "var(--red)", marginBottom: 12 }}>{error}</p>}
          <button type="submit" disabled={busy} className="btn btn-primary">
            {busy
              ? "Please wait…"
              : passwordMode === "sign-in"
                ? "Sign in"
                : "Create account"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setPasswordMode(passwordMode === "sign-in" ? "register" : "sign-in");
              setError(null);
            }}
            style={{ width: "100%", marginTop: 12 }}
          >
            {passwordMode === "sign-in"
              ? "Need an account? Create one"
              : "Already have an account? Sign in"}
          </button>
        </form>
      )}

      {setupHints?.smsReady && (
        <details style={{ fontSize: "0.9rem", color: "#666", marginTop: 20 }}>
          <summary style={{ cursor: "pointer", marginBottom: 8 }}>
            Sign in with SMS (optional)
          </summary>
          <form onSubmit={smsStep === "phone" ? sendSmsCode : verifySmsCode}>
            <p style={{ marginBottom: 12, fontSize: "0.9rem" }}>
              {smsStep === "phone"
                ? "UK mobile — we'll text a one-time code."
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
                <button
                  type="button"
                  className="btn btn-secondary btn-nav"
                  onClick={() => {
                    setSmsStep("phone");
                    setCode("");
                  }}
                  style={{ marginBottom: 12 }}
                >
                  ← Different number
                </button>
              </>
            )}
            {error && tab !== "email-code" && tab !== "email-password" && (
              <p style={{ color: "var(--red)", marginBottom: 12 }}>{error}</p>
            )}
            <button type="submit" disabled={busy} className="btn btn-primary">
              {busy ? "Please wait…" : smsStep === "phone" ? "Send code" : "Verify & sign in"}
            </button>
          </form>
        </details>
      )}
    </div>
  );
}
