import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { InvoiceList } from "@/components/invoice-list";
import { requireCurrentOrg } from "@/lib/auth";
import { listClients, listInvoices } from "@/lib/data";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Invoices · InvoiceBro" };
export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const { org, user } = await requireCurrentOrg();
  const [invoices, clients] = await Promise.all([
    listInvoices(org.id),
    listClients(org.id),
  ]);

  const outstanding = invoices
    .filter((invoice) => invoice.status !== "void" && invoice.status !== "draft")
    .reduce((sum, invoice) => sum + invoice.balanceCents, 0);

  return (
    <AppShell org={org} user={user} current="/invoices">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Invoices</h1>
          <p className="mt-1 text-sm text-slate-500">
            {invoices.length === 0
              ? "No invoices yet."
              : `${invoices.length} invoice${invoices.length === 1 ? "" : "s"} · ${formatMoney(
                  outstanding,
                  org.defaults.currency,
                )} outstanding`}
          </p>
        </div>

        {clients.length > 0 ? (
          <Link
            href="/invoices/new"
            className="flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 sm:w-auto"
          >
            New invoice
          </Link>
        ) : null}
      </div>

      {clients.length === 0 ? (
        <EmptyState
          title="Add a client first"
          body="An invoice needs someone to bill. Add your first client and you can start invoicing straight away."
          action={{ href: "/clients", label: "Add a client" }}
        />
      ) : invoices.length === 0 ? (
        <EmptyState
          title="No invoices yet"
          body="Create your first invoice and download it as a PDF."
          action={{ href: "/invoices/new", label: "New invoice" }}
        />
      ) : (
        <InvoiceList invoices={invoices} currency={org.defaults.currency} />
      )}
    </AppShell>
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action: { href: string; label: string };
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <h2 className="text-base font-medium text-slate-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">{body}</p>
      <Link
        href={action.href}
        className="mt-6 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
      >
        {action.label}
      </Link>
    </div>
  );
}
