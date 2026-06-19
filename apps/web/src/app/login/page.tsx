import Image from "next/image";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/dashboard/LoginForm";
import { BtnLink } from "@/components/dashboard/ui";
import { googleRedirectUri } from "@/lib/auth/google";
import { getServerUser } from "@/lib/auth/server";

export const metadata = { title: "Sign in — Cricket Scoring" };

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
        <Image
          src="/logo-full.png"
          alt="Howzzat — Cricket Scoring App"
          width={260}
          height={78}
          priority
          style={{ height: "auto", maxWidth: "100%", margin: "0 auto" }}
        />
        <p style={{ color: "#666", marginTop: 12 }}>Sign in to your club dashboard</p>
      </header>
      <LoginForm
        redirectTo={redirectTo ?? "/dashboard"}
        initialError={errorMessage}
        defaultTab={
          process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim()
            ? "email-code"
            : "email-password"
        }
        setupHints={{
          googleRedirectUri: googleRedirectUri(),
          emailOtpReady: Boolean(
            process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim(),
          ),
          smsReady: Boolean(process.env.TWILIO_VERIFY_SERVICE_SID?.trim()),
        }}
      />
      <p style={{ textAlign: "center", marginTop: 20 }}>
        <BtnLink href="/" variant="secondary">
          ← Back to home
        </BtnLink>
      </p>
    </main>
  );
}
