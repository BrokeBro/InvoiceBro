import { AppShell } from "@/components/app-shell";
import { ObservationTemplateList } from "@/components/observation-template-editor";
import { requireCurrentOrg } from "@/lib/auth";
import { listObservationTemplates } from "@/lib/data";

export const metadata = { title: "Observation templates · InvoiceBro" };
export const dynamic = "force-dynamic";

export default async function ObservationTemplatesPage() {
  const { org, user } = await requireCurrentOrg();
  const templates = await listObservationTemplates(org.id);

  return (
    <AppShell org={org} user={user} current="/settings/observation-templates">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Observation templates</h1>
        <p className="mt-1 text-sm text-slate-500">
          Create reusable templates for adding observations to invoices.
        </p>
      </div>
      <ObservationTemplateList templates={templates} />
    </AppShell>
  );
}
