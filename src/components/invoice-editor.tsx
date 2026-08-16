"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { addDaysIso, todayIso } from "@/lib/dates";
import { centsToInput, computeTotals, formatMoney, parseMoneyToCents } from "@/lib/money";
import { saveInvoice } from "@/app/actions/invoices";
import { CURRENCIES } from "@/lib/defaults";
import { TEMPLATE_IDS, type Client, type Invoice, type Organization, type TemplateId } from "@/lib/types";

// A row's price is held as the raw string the user is typing, so that "12." or
// an empty field stays editable instead of being yanked to 0 mid-keystroke.
// It's converted to cents only when the value is read.
type EditorRow = {
  key: string;
  description: string;
  quantity: string;
  price: string;
  taxRatePercent: string;
};

function rowsFromInvoice(invoice: Invoice | null, org: Organization): EditorRow[] {
  if (!invoice || invoice.lineItems.length === 0) {
    return [
      {
        key: crypto.randomUUID(),
        description: "",
        quantity: "1",
        price: "0.00",
        taxRatePercent: String(org.defaults.taxRatePercent),
      },
    ];
  }

  return invoice.lineItems.map((item) => ({
    key: crypto.randomUUID(),
    description: item.description,
    quantity: String(item.quantity),
    price: centsToInput(item.unitPriceCents),
    taxRatePercent: String(item.taxRatePercent),
  }));
}

export function InvoiceEditor({
  organization,
  clients,
  invoice,
}: {
  organization: Organization;
  clients: Client[];
  invoice: Invoice | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [clientId, setClientId] = useState(invoice?.client.id ?? clients[0]?.id ?? "");
  const [issueDate, setIssueDate] = useState(invoice?.issueDate ?? todayIso());
  const [dueDate, setDueDate] = useState(
    invoice?.dueDate ?? addDaysIso(todayIso(), organization.defaults.paymentTermsDays),
  );
  const [currency, setCurrency] = useState(
    invoice?.currency ?? organization.defaults.currency,
  );
  const [notes, setNotes] = useState(invoice?.notes ?? organization.defaults.notes ?? "");
  const [terms, setTerms] = useState(invoice?.terms ?? "");
  const [templateOverride, setTemplateOverride] = useState<TemplateId | "">(
    invoice?.templateOverride ?? "",
  );
  const [rows, setRows] = useState<EditorRow[]>(() => rowsFromInvoice(invoice, organization));

  // Totals use the exact same computeTotals() the server uses, so the figures
  // on screen can never disagree with the figures in the PDF.
  const totals = useMemo(
    () =>
      computeTotals(
        rows.map((row) => ({
          description: row.description,
          quantity: Number(row.quantity) || 0,
          unitPriceCents: parseMoneyToCents(row.price) ?? 0,
          taxRatePercent: Number(row.taxRatePercent) || 0,
        })),
      ),
    [rows],
  );

  function updateRow(key: string, patch: Partial<EditorRow>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function addRow() {
    setRows((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        description: "",
        quantity: "1",
        price: "0.00",
        taxRatePercent: String(organization.defaults.taxRatePercent),
      },
    ]);
  }

  function removeRow(key: string) {
    setRows((current) => (current.length === 1 ? current : current.filter((row) => row.key !== key)));
  }

  function submit() {
    setError(null);

    if (!clientId) {
      setError("Choose a client");
      return;
    }

    const lineItems = rows
      .filter((row) => row.description.trim() !== "")
      .map((row) => ({
        description: row.description.trim(),
        quantity: Number(row.quantity) || 0,
        unitPriceCents: parseMoneyToCents(row.price) ?? 0,
        taxRatePercent: Number(row.taxRatePercent) || 0,
      }));

    if (lineItems.length === 0) {
      setError("Add at least one line item with a description");
      return;
    }

    const formData = new FormData();
    formData.set(
      "payload",
      JSON.stringify({
        clientId,
        issueDate,
        dueDate,
        currency,
        lineItems,
        notes,
        terms,
        templateOverride: templateOverride === "" ? null : templateOverride,
      }),
    );

    startTransition(async () => {
      const result = await saveInvoice(invoice?.id ?? null, formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.push(`/invoices/${result.id}`);
      router.refresh();
    });
  }

  const money = (cents: number) => formatMoney(cents, currency);

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Client">
            <select
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              className={inputClass}
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Issue date">
            <input
              type="date"
              value={issueDate}
              onChange={(event) => {
                const value = event.target.value;
                setIssueDate(value);
                // Keep the due date in step with the payment terms unless the
                // user has deliberately moved it.
                setDueDate(addDaysIso(value, organization.defaults.paymentTermsDays));
              }}
              className={inputClass}
            />
          </Field>

          <Field label="Due date">
            <input
              type="date"
              value={dueDate}
              min={issueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Currency">
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              className={inputClass}
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Line items</h2>

        <div className="space-y-2">
          <div className="hidden gap-2 px-1 text-xs font-medium uppercase tracking-wide text-slate-500 sm:grid sm:grid-cols-[1fr_80px_120px_80px_100px_32px]">
            <span>Description</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Unit price</span>
            <span className="text-right">Tax %</span>
            <span className="text-right">Amount</span>
            <span />
          </div>

          {rows.map((row) => {
            const amount =
              (parseMoneyToCents(row.price) ?? 0) * (Number(row.quantity) || 0);

            return (
              <div
                key={row.key}
                className="grid gap-2 sm:grid-cols-[1fr_80px_120px_80px_100px_32px] sm:items-center"
              >
                <input
                  value={row.description}
                  onChange={(event) => updateRow(row.key, { description: event.target.value })}
                  placeholder="What are you billing for?"
                  className={inputClass}
                />
                <input
                  value={row.quantity}
                  inputMode="decimal"
                  onChange={(event) => updateRow(row.key, { quantity: event.target.value })}
                  className={`${inputClass} sm:text-right`}
                />
                <input
                  value={row.price}
                  inputMode="decimal"
                  onChange={(event) => updateRow(row.key, { price: event.target.value })}
                  onBlur={(event) => {
                    const cents = parseMoneyToCents(event.target.value);
                    updateRow(row.key, { price: cents === null ? "0.00" : centsToInput(cents) });
                  }}
                  className={`${inputClass} sm:text-right`}
                />
                <input
                  value={row.taxRatePercent}
                  inputMode="decimal"
                  onChange={(event) =>
                    updateRow(row.key, { taxRatePercent: event.target.value })
                  }
                  className={`${inputClass} sm:text-right`}
                />
                <span className="px-1 text-right text-sm tabular-nums text-slate-700">
                  {money(Math.round(amount))}
                </span>
                <button
                  type="button"
                  onClick={() => removeRow(row.key)}
                  disabled={rows.length === 1}
                  aria-label="Remove line"
                  className="rounded-md px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={addRow}
          className="mt-4 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
        >
          + Add line
        </button>

        <div className="mt-6 flex justify-end">
          <dl className="w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Subtotal</dt>
              <dd className="tabular-nums">{money(totals.subtotalCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Tax</dt>
              <dd className="tabular-nums">{money(totals.taxCents)}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{money(totals.totalCents)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
        <Field label="Notes (shown on the invoice)">
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            className={inputClass}
            placeholder="Thanks for your business!"
          />
        </Field>
        <Field label="Terms">
          <textarea
            value={terms}
            onChange={(event) => setTerms(event.target.value)}
            rows={3}
            className={inputClass}
            placeholder="Payment due within 30 days."
          />
        </Field>
        <Field label="PDF template">
          <select
            value={templateOverride}
            onChange={(event) => setTemplateOverride(event.target.value as TemplateId | "")}
            className={inputClass}
          >
            <option value="">
              Use default ({organization.branding.template})
            </option>
            {TEMPLATE_IDS.map((id) => (
              <option key={id} value={id}>
                {id[0].toUpperCase() + id.slice(1)}
              </option>
            ))}
          </select>
        </Field>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : invoice ? "Save changes" : "Create invoice"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg px-4 py-2 text-sm text-slate-600 transition hover:text-slate-900"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
