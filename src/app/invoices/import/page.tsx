import { AppShell } from "@/components/app-shell";
import { InvoiceImporter } from "@/components/invoice-importer";
import { requireCurrentOrg } from "@/lib/auth";
import { listClients } from "@/lib/data";

export const metadata = { title: "Import Invoice · InvoiceBro" };
export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const { org, user } = await requireCurrentOrg();
  const clients = await listClients(org.id);

  return (
    <AppShell org={org} user={user} current="/invoices">
      <h1 className="mb-6 text-2xl font-semibold">Import Invoice</h1>
      <InvoiceImporter
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        defaultCurrency={org.defaults.currency}
      />
    </AppShell>
  );
}
