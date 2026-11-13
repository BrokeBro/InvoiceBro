import Link from "next/link";

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
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="mt-1 text-sm text-slate-500">
            These details appear on every invoice and PDF you produce.
          </p>
        </div>
        <Link
          href="/settings/observation-templates"
          className="flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto"
        >
          Observation templates
        </Link>
      </div>
      <OrganizationForm organization={org} logoUrl={logoUrl} />
    </AppShell>
  );
}
