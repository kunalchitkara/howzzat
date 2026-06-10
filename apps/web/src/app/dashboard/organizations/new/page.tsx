import Link from "next/link";
import { CreateOrgForm } from "@/components/dashboard/forms";
import { PageShell } from "@/components/dashboard/ui";

export default function NewOrganizationPage() {
  return (
    <PageShell title="Create a club" subtitle="Set up your cricket organization">
      <p style={{ marginBottom: 16 }}>
        <Link href="/dashboard">← Back to dashboard</Link>
      </p>
      <CreateOrgForm />
    </PageShell>
  );
}
