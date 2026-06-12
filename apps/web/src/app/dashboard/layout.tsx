import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/dashboard/LogoutButton";
import { getServerUser } from "@/lib/auth/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getServerUser();
  if (!user) redirect("/login?redirect=/dashboard");

  return (
    <div style={{ minHeight: "100vh", background: "#eef2f7" }}>
      <nav
        style={{
          background: "var(--dk)",
          color: "#fff",
          padding: "12px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <Link
            href="/dashboard"
            style={{
              color: "#fff",
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              gap: 8,
              textDecoration: "none",
            }}
          >
            <Image src="/logo-icon.png" alt="" width={28} height={28} aria-hidden />
            Howzzat
          </Link>
          <Link href="/dashboard" style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.9rem" }}>
            My clubs
          </Link>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: "0.85rem", opacity: 0.9 }}>
            {user.name ?? user.email}
          </span>
          <Link
            href="/dashboard/account"
            style={{
              color: "rgba(255,255,255,0.9)",
              fontSize: "0.85rem",
              textDecoration: "none",
            }}
          >
            Account
          </Link>
          <LogoutButton />
        </div>
      </nav>
      <main style={{ padding: "24px 16px" }}>{children}</main>
    </div>
  );
}
