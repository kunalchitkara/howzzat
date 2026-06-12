import { CreateOrgForm } from "@/components/dashboard/forms";
import { BtnLink, PageShell } from "@/components/dashboard/ui";

export default function NewOrganizationPage() {
  return (
    <PageShell title="Create a club" subtitle="Set up your cricket organization">
      <p style={{ marginBottom: 16 }}>
        <BtnLink href="/dashboard" variant="secondary" className="btn-nav">
          ← Dashboard
        </BtnLink>
      </p>
      <CreateOrgForm />
    </PageShell>
  );
}
