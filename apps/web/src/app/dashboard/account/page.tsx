import { redirect } from "next/navigation";
import { AccountSettings } from "@/components/dashboard/AccountSettings";
import { PageShell } from "@/components/dashboard/ui";
import { getUserProfile, serializeMeUser } from "@/lib/auth/profile";
import { getServerUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const user = await getServerUser();
  if (!user) redirect("/login?redirect=/dashboard/account");

  const full = await getUserProfile(user.id);
  if (!full) redirect("/login?redirect=/dashboard/account");

  const params = await searchParams;
  const googleLinked = params.google === "linked";

  return (
    <PageShell
      title="Account"
      subtitle="Manage your profile, password, and connected sign-in methods"
    >
      <AccountSettings
        initialUser={serializeMeUser(full)}
        googleLinked={googleLinked}
      />
    </PageShell>
  );
}
