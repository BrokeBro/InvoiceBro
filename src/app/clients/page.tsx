import { AppShell } from "@/components/app-shell";
import { ClientManager } from "@/components/client-manager";
import { requireCurrentOrg } from "@/lib/auth";
import { listClients } from "@/lib/data";

export const metadata = { title: "Clients · InvoiceBro" };
export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const { org, user } = await requireCurrentOrg();
  const clients = await listClients(org.id);

  return (
    <AppShell org={org} user={user} current="/clients">
      <ClientManager
        clients={clients}
        defaultCurrency={org.defaults.currency}
        defaultTaxRate={org.defaults.taxRatePercent}
      />
    </AppShell>
  );
}
