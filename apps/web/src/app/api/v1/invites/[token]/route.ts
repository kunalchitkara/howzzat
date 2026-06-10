import { json } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export const GET = withApi(async (_request, { params }) => {
  const { token } = await params;
  const invite = await prisma.tournamentInvite.findUnique({
    where: { token },
    include: {
      tournament: { include: { organization: true } },
      team: true,
    },
  });
  if (!invite) {
    return json({ error: "Invite not found", code: "INVITE_NOT_FOUND" }, 404);
  }
  return json({
    data: {
      email: invite.email,
      role: invite.role,
      acceptedAt: invite.acceptedAt,
      expiresAt: invite.expiresAt,
      tournament: {
        id: invite.tournament.id,
        name: invite.tournament.name,
        slug: invite.tournament.slug,
      },
      organization: {
        name: invite.tournament.organization.name,
        slug: invite.tournament.organization.slug,
      },
      team: invite.team
        ? { id: invite.team.id, name: invite.team.name }
        : null,
    },
  });
});
