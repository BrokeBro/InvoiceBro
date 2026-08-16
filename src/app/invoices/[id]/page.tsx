import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { InvoiceActions } from "@/components/invoice-actions";
import { requireCurrentOrg } from "@/lib/auth";
import { getInvoice } from "@/lib/data";
import { formatDate } from "@/lib/dates";
import { STATUS_LABELS, STATUS_STYLES } from "@/lib/invoice-status";
import { formatMoney, lineSubtotalCents } from "@/lib/money";
import { resolveTemplate } from "@/lib/pdf/render";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { org, user } = await requireCurrentOrg();

  const invoice = await getInvoice(org.id, id);
  if (!invoice) notFound();

  const money = (cents: number) => formatMoney(cents, invoice.currency);
  const template = resolveTemplate(invoice, org);

  return (
    <AppShell org={org} user={user} current="/invoices">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{invoice.number ?? "Draft invoice"}</h1>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[invoice.status]}`}
            >
              {STATUS_LABELS[invoice.status]}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {invoice.client.name} · due {formatDate(invoice.dueDate)}
          </p>
        </div>

        <InvoiceActions invoice={invoice} template={template} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left">
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 text-right font-medium">Qty</th>
                  <th className="px-4 py-3 text-right font-medium">Rate</th>
                  <th className="px-4 py-3 text-right font-medium">Tax</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item, index) => (
                  <tr key={index} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3">{item.description}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{item.quantity}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {money(item.unitPriceCents)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                      {item.taxRatePercent}%
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {money(lineSubtotalCents(item))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-4 py-4">
              <dl className="w-full max-w-xs space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Subtotal</dt>
                  <dd className="tabular-nums">{money(invoice.subtotalCents)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Tax</dt>
                  <dd className="tabular-nums">{money(invoice.taxCents)}</dd>
                </div>
                {invoice.amountPaidCents > 0 ? (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Paid</dt>
                    <dd className="tabular-nums">-{money(invoice.amountPaidCents)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-slate-300 pt-2 text-base font-semibold">
                  <dt>{invoice.amountPaidCents > 0 ? "Balance due" : "Total"}</dt>
                  <dd className="tabular-nums">{money(invoice.balanceCents)}</dd>
                </div>
              </dl>
            </div>
          </div>

          {invoice.notes || invoice.terms ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {invoice.notes ? (
                <Panel title="Notes">{invoice.notes}</Panel>
              ) : null}
              {invoice.terms ? <Panel title="Terms">{invoice.terms}</Panel> : null}
            </div>
          ) : null}
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
              Billed to
            </h2>
            <p className="font-medium">{invoice.client.name}</p>
            {invoice.client.address ? (
              <p className="mt-1 whitespace-pre-line text-sm text-slate-600">
                {invoice.client.address}
              </p>
            ) : null}
            {invoice.client.email ? (
              <p className="mt-1 text-sm text-slate-600">{invoice.client.email}</p>
            ) : null}
            {invoice.client.vatNumber ? (
              <p className="mt-1 text-sm text-slate-500">VAT {invoice.client.vatNumber}</p>
            ) : null}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
              Details
            </h2>
            <Row label="Issued" value={formatDate(invoice.issueDate)} />
            <Row label="Due" value={formatDate(invoice.dueDate)} />
            <Row label="Currency" value={invoice.currency} />
            <Row label="Template" value={template} />
          </div>

          {invoice.status === "draft" ? (
            <p className="rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-800">
              This is a draft. It has no invoice number yet — issuing it assigns
              the next number in your sequence.
            </p>
          ) : null}
        </aside>
      </div>

      <div className="mt-8">
        <Link href="/invoices" className="text-sm text-slate-500 hover:text-slate-900">
          ← Back to invoices
        </Link>
      </div>
    </AppShell>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      <p className="whitespace-pre-line text-sm text-slate-600">{children}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-slate-500">{label}</span>
      <span className="capitalize">{value}</span>
    </div>
  );
}
