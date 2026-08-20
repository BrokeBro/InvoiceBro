import { AppShell } from "@/components/app-shell";
import { MetricsDashboard } from "@/components/metrics-dashboard";
import { requireCurrentOrg } from "@/lib/auth";
import { listInvoices } from "@/lib/data";

export const metadata = { title: "Metrics · InvoiceBro" };
export const dynamic = "force-dynamic";

export default async function MetricsPage() {
  const { org, user } = await requireCurrentOrg();
  const invoices = await listInvoices(org.id);

  return (
    <AppShell org={org} user={user} current="/metrics">
      <h1 className="mb-6 text-2xl font-semibold">Metrics</h1>
      <MetricsDashboard invoices={invoices} currency={org.defaults.currency} />
    </AppShell>
  );
}
