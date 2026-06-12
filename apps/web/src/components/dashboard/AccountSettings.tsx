"use client";

import { useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";
import { apiFetch } from "@/lib/client/api";
import type { AccountProfile } from "@/lib/auth/profile";
import { btn, card, Field, input } from "./ui";

type MeUser = {
  id: string;
  email: string;
  name: string | null;
  profile: AccountProfile;
};

function stepCardStyle(done: boolean): CSSProperties {
  return {
    ...card,
    borderLeft: `4px solid ${done ? "var(--md)" : "var(--amber, #e6a817)"}`,
  };
}

function StepBadge({ done, label }: { done: boolean; label: string }) {
  return (
    <span
      style={{
        fontSize: "0.75rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        color: done ? "var(--md)" : "#b8860b",
        marginBottom: 8,
        display: "inline-block",
      }}
    >
      {done ? "Done" : label}
    </span>
  );
}

export function AccountSettings({
  initialUser,
  googleLinked,
}: {
  initialUser: MeUser;
  googleLinked?: boolean;
}) {
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [name, setName] = useState(user.name ?? "");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(
    googleLinked ? "Google account connected." : null,
  );

  const steps = user.profile.steps;
  const completedCount = Object.values(steps).filter(Boolean).length;
  const totalSteps = Object.keys(steps).length;

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await apiFetch<MeUser>("/api/v1/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim() }),
      });
      setUser(data);
      setSuccess("Name updated.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update name");
    } finally {
      setBusy(false);
    }
  }

  async function setPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await apiFetch<MeUser>("/api/v1/auth/password/set", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      setUser(data);
      setPassword("");
      setSuccess("Password set.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set password");
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await apiFetch<MeUser>("/api/v1/auth/password/change", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setUser(data);
      setCurrentPassword("");
      setNewPassword("");
      setSuccess("Password changed.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password");
    } finally {
      setBusy(false);
    }
  }

  const googleHref = `/api/v1/auth/google?link=1&redirect=${encodeURIComponent("/dashboard/account")}`;

  return (
    <div>
      <div style={{ ...card, background: "#f8fafc" }}>
        <p style={{ margin: 0, fontWeight: 700, color: "var(--dk)" }}>
          Account setup · {completedCount}/{totalSteps} complete
        </p>
        <p style={{ margin: "6px 0 0", fontSize: "0.9rem", color: "#666" }}>
          Finish the steps below to secure your Howzzat account.
        </p>
      </div>

      {success && (
        <p style={{ color: "var(--md)", marginBottom: 12, fontWeight: 600 }}>{success}</p>
      )}
      {error && <p style={{ color: "var(--red)", marginBottom: 12 }}>{error}</p>}

      <section style={stepCardStyle(steps.name)}>
        <StepBadge done={steps.name} label="Step 1 — Add your name" />
        <h2 style={{ margin: "0 0 12px", fontSize: "1.1rem", color: "var(--dk)" }}>
          Display name
        </h2>
        <form onSubmit={saveName}>
          <Field label="Name">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={input}
              placeholder="Manager or parent name"
            />
          </Field>
          <button type="submit" disabled={busy || !name.trim()} style={btn}>
            {steps.name ? "Update name" : "Save name"}
          </button>
        </form>
      </section>

      <section style={stepCardStyle(steps.email)}>
        <StepBadge done={steps.email} label="Step 2 — Verify email" />
        <h2 style={{ margin: "0 0 8px", fontSize: "1.1rem", color: "var(--dk)" }}>Email</h2>
        <p style={{ margin: "0 0 4px", fontSize: "1rem" }}>{user.email}</p>
        <p style={{ margin: 0, fontSize: "0.85rem", color: "#666" }}>
          {user.profile.emailVerified
            ? "Verified — this is your sign-in identity and cannot be changed here."
            : "Not verified yet — sign in with email code to verify."}
          {user.profile.hasGoogle && " Linked Google accounts use this same email."}
        </p>
      </section>

      <section style={stepCardStyle(steps.password)}>
        <StepBadge
          done={steps.password}
          label={user.profile.hasPassword ? "Password set" : "Step 3 — Set a password"}
        />
        <h2 style={{ margin: "0 0 12px", fontSize: "1.1rem", color: "var(--dk)" }}>Password</h2>
        {user.profile.hasPassword ? (
          <form onSubmit={changePassword}>
            <Field label="Current password">
              <input
                required
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                style={input}
              />
            </Field>
            <Field label="New password">
              <input
                required
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={input}
              />
            </Field>
            <button type="submit" disabled={busy} style={btn}>
              Change password
            </button>
          </form>
        ) : (
          <form onSubmit={setPassword}>
            <Field label="Choose a password">
              <input
                required
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={input}
              />
            </Field>
            <button type="submit" disabled={busy} style={btn}>
              Set password
            </button>
          </form>
        )}
      </section>

      <section style={stepCardStyle(steps.google)}>
        <StepBadge
          done={steps.google}
          label={steps.google ? "Google connected" : "Step 4 — Connect Google"}
        />
        <h2 style={{ margin: "0 0 12px", fontSize: "1.1rem", color: "var(--dk)" }}>
          Google sign-in
        </h2>
        {user.profile.hasGoogle ? (
          <p style={{ margin: 0, color: "var(--md)", fontWeight: 600 }}>Connected</p>
        ) : (
          <div>
            <p style={{ margin: "0 0 12px", fontSize: "0.9rem", color: "#666" }}>
              Link Google to sign in faster. Your Google email must match{" "}
              <strong>{user.email}</strong>.
            </p>
            <a href={googleHref} style={{ ...btn, display: "inline-block", textDecoration: "none" }}>
              Connect Google
            </a>
          </div>
        )}
      </section>
    </div>
  );
}
