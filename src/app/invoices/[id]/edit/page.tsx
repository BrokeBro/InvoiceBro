import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { InvoiceEditor } from "@/components/invoice-editor";
import { requireCurrentOrg } from "@/lib/auth";
import { getInvoice, listClients } from "@/lib/data";

export const metadata = { title: "Edit invoice · InvoiceBro" };
export const dynamic = "force-dynamic";

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { org, user } = await requireCurrentOrg();

  const [invoice, clients] = await Promise.all([
    getInvoice(org.id, id),
    listClients(org.id),
  ]);

  if (!invoice) notFound();

  return (
    <AppShell org={org} user={user} current="/invoices">
      <h1 className="mb-6 text-2xl font-semibold">
        Edit {invoice.number ?? "draft invoice"}
      </h1>
      <InvoiceEditor organization={org} clients={clients} invoice={invoice} />
    </AppShell>
  );
}
