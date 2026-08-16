import { AppShell } from "@/components/app-shell";
import { OrganizationForm } from "@/components/organization-form";
import { requireCurrentOrg } from "@/lib/auth";
import { getLogoUrl } from "@/lib/data";

export const metadata = { title: "Settings · InvoiceBro" };
export const dynamic = "force-dynamic";

export default async function OrganizationSettingsPage() {
  const { org, user } = await requireCurrentOrg();
  const logoUrl = await getLogoUrl(org.logoPath);

  return (
    <AppShell org={org} user={user} current="/settings">
      <h1 className="mb-1 text-2xl font-semibold">Settings</h1>
      <p className="mb-6 text-sm text-slate-500">
        These details appear on every invoice and PDF you produce.
      </p>
      <OrganizationForm organization={org} logoUrl={logoUrl} />
    </AppShell>
  );
}
