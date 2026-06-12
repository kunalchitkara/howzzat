import { AcceptInviteButton } from "@/components/dashboard/forms";
import { LoginForm } from "@/components/dashboard/LoginForm";
import { BtnLink, card, PageShell } from "@/components/dashboard/ui";
import { getServerUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { acceptInvite } from "@/lib/services/invites";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await prisma.tournamentInvite.findUnique({
    where: { token },
    include: {
      tournament: { include: { organization: true } },
      team: true,
    },
  });
  if (!invite) notFound();

  const user = await getServerUser();
  const expired = invite.expiresAt && invite.expiresAt < new Date();

  if (
    user &&
    !invite.acceptedAt &&
    !expired &&
    user.email.toLowerCase() === invite.email.toLowerCase()
  ) {
    await acceptInvite(token, user.id);
    redirect("/dashboard");
  }

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "2rem 1rem" }}>
      <PageShell
        title="Tournament invite"
        subtitle={`${invite.tournament.organization.name} — ${invite.tournament.name}`}
      >
        <div style={card}>
          <p>
            <strong>{invite.email}</strong> invited as{" "}
            <strong>
              {invite.kind === "MANAGER"
                ? "tournament manager"
                : invite.role === "SCORER"
                  ? "scorer"
                  : invite.role.toLowerCase()}
            </strong>
            {invite.team ? ` for ${invite.team.name}` : ""}.
          </p>
          {invite.acceptedAt && (
            <p style={{ color: "var(--md)", marginTop: 12, fontWeight: 600 }}>
              Already accepted — you can open the dashboard.
            </p>
          )}
          {expired && !invite.acceptedAt && (
            <p style={{ color: "var(--red)", marginTop: 12 }}>This invite has expired.</p>
          )}
        </div>

        {!invite.acceptedAt && !expired && (
          <>
            {user ? (
              <div style={card}>
                <p style={{ marginBottom: 12 }}>
                  Signed in as <strong>{user.name ?? user.email}</strong>
                </p>
                <AcceptInviteButton token={token} />
              </div>
            ) : (
              <>
                <p style={{ marginBottom: 12, color: "#666" }}>
                  Sign in with the invited email to accept:
                </p>
                <LoginForm
                  redirectTo={`/invite/${token}`}
                  initialEmail={invite.email}
                  defaultTab="email-password"
                />
              </>
            )}
          </>
        )}

        <div className="btn-group" style={{ marginTop: 16 }}>
          <BtnLink href="/dashboard" variant="secondary" className="btn-nav">
            Dashboard
          </BtnLink>
          <BtnLink href="/" variant="secondary" className="btn-nav">
            Home
          </BtnLink>
        </div>
      </PageShell>
    </main>
  );
}
