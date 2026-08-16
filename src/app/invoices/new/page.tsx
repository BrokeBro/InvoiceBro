import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { InvoiceEditor } from "@/components/invoice-editor";
import { requireCurrentOrg } from "@/lib/auth";
import { listClients } from "@/lib/data";

export const metadata = { title: "New invoice · InvoiceBro" };
export const dynamic = "force-dynamic";

export default async function NewInvoicePage() {
  const { org, user } = await requireCurrentOrg();
  const clients = await listClients(org.id);

  if (clients.length === 0) redirect("/clients");

  return (
    <AppShell org={org} user={user} current="/invoices">
      <h1 className="mb-6 text-2xl font-semibold">New invoice</h1>
      <InvoiceEditor organization={org} clients={clients} invoice={null} />
    </AppShell>
  );
}
