import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/dashboard/LoginForm";
import { getServerUser } from "@/lib/auth/server";

export const metadata = { title: "Sign in — Howzzat" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const user = await getServerUser();
  const { redirect: redirectTo } = await searchParams;
  if (user) redirect(redirectTo ?? "/dashboard");

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "2rem 1rem" }}>
      <header style={{ marginBottom: 24, textAlign: "center" }}>
        <h1 style={{ color: "var(--dk)", fontSize: "2rem", fontWeight: 800 }}>Howzzat</h1>
        <p style={{ color: "#666", marginTop: 8 }}>Sign in to manage your club</p>
      </header>
      <LoginForm redirectTo={redirectTo ?? "/dashboard"} />
      <p style={{ textAlign: "center", marginTop: 16, fontSize: "0.9rem" }}>
        <Link href="/">← Back to home</Link>
      </p>
    </main>
  );
}
