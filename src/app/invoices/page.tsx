import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { requireCurrentOrg } from "@/lib/auth";
import { listClients, listInvoices } from "@/lib/data";
import { formatDate } from "@/lib/dates";
import { STATUS_LABELS, STATUS_STYLES } from "@/lib/invoice-status";
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
      <div className="mb-6 flex items-end justify-between">
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
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
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
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left">
              <tr className="text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-medium">Number</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Issued</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/invoices/${invoice.id}`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {invoice.number ?? "Draft"}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{invoice.client.name}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(invoice.issueDate)}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(invoice.dueDate)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[invoice.status]}`}
                    >
                      {STATUS_LABELS[invoice.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {formatMoney(invoice.totalCents, invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
