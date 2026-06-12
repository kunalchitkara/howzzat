import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/dashboard/LoginForm";
import { googleRedirectUri } from "@/lib/auth/google";
import { getServerUser } from "@/lib/auth/server";

export const metadata = { title: "Sign in — Howzzat" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  const user = await getServerUser();
  const { redirect: redirectTo, error } = await searchParams;
  if (user) redirect(redirectTo ?? "/dashboard");

  const errorMessage =
    error === "oauth_state"
      ? "Google sign-in expired. Please try again."
      : error
        ? "Google sign-in was cancelled or failed."
        : null;

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "2rem 1rem" }}>
      <header style={{ marginBottom: 24, textAlign: "center" }}>
        <h1 style={{ color: "var(--dk)", fontSize: "2rem", fontWeight: 800 }}>Howzzat</h1>
        <p style={{ color: "#666", marginTop: 8 }}>
          Sign in to manage tournaments, squads, and scores
        </p>
      </header>
      <LoginForm
        redirectTo={redirectTo ?? "/dashboard"}
        initialError={errorMessage}
        setupHints={{
          googleRedirectUri: googleRedirectUri(),
          smsReady: Boolean(process.env.TWILIO_AUTH_TOKEN?.trim()),
        }}
      />
      <p style={{ textAlign: "center", marginTop: 16, fontSize: "0.9rem" }}>
        <Link href="/">← Back to home</Link>
      </p>
    </main>
  );
}
