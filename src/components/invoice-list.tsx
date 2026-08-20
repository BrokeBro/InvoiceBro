"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";

import { bulkSetStatus, markPaid, markUnpaid } from "@/app/actions/invoices";
import { formatDate } from "@/lib/dates";
import { STATUS_LABELS, STATUS_STYLES } from "@/lib/invoice-status";
import { formatMoney } from "@/lib/money";
import type { Invoice } from "@/lib/types";

export function InvoiceList({
  invoices,
  currency,
}: {
  invoices: Invoice[];
  currency: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statusMenu, setStatusMenu] = useState(false);
  const [longPressId, setLongPressId] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const selectable = invoices.filter(
      (inv) => inv.status !== "draft" && inv.status !== "void",
    );
    setSelected((prev) =>
      prev.size === selectable.length
        ? new Set()
        : new Set(selectable.map((inv) => inv.id)),
    );
  }, [invoices]);

  function applyBulk(status: "paid" | "unpaid") {
    setStatusMenu(false);
    startTransition(async () => {
      await bulkSetStatus([...selected], status);
      setSelected(new Set());
      router.refresh();
    });
  }

  function handleLongPressStart(invoice: Invoice) {
    if (invoice.status === "draft" || invoice.status === "void") return;
    longPressTimer.current = setTimeout(() => {
      setLongPressId(invoice.id);
    }, 500);
  }

  function handleLongPressEnd() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function quickToggle(invoice: Invoice) {
    setLongPressId(null);
    startTransition(async () => {
      if (invoice.status === "paid") {
        await markUnpaid(invoice.id);
      } else {
        await markPaid(invoice.id);
      }
      router.refresh();
    });
  }

  const selectable = invoices.filter(
    (inv) => inv.status !== "draft" && inv.status !== "void",
  );
  const hasSelection = selected.size > 0;

  return (
    <>
      {/* Bulk toolbar */}
      {selectable.length > 0 ? (
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
          >
            {selected.size === selectable.length ? "Deselect all" : "Select all"}
          </button>

          {hasSelection ? (
            <div className="relative">
              <button
                type="button"
                disabled={pending}
                onClick={() => setStatusMenu(!statusMenu)}
                className="min-h-9 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                Invoice status ({selected.size})
              </button>
              {statusMenu ? (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setStatusMenu(false)}
                  />
                  <div className="absolute left-0 z-20 mt-1 w-40 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => applyBulk("paid")}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-emerald-50"
                    >
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      Mark paid
                    </button>
                    <button
                      type="button"
                      onClick={() => applyBulk("unpaid")}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-red-50"
                    >
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
                      Mark unpaid
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Mobile cards */}
      <ul className="space-y-2 sm:hidden">
        {invoices.map((invoice) => {
          const canSelect =
            invoice.status !== "draft" && invoice.status !== "void";
          return (
            <li key={invoice.id} className="relative">
              <div
                className={`block rounded-xl border bg-white p-4 transition ${
                  selected.has(invoice.id)
                    ? "border-blue-400 ring-2 ring-blue-100"
                    : "border-slate-200"
                }`}
                onTouchStart={() => handleLongPressStart(invoice)}
                onTouchEnd={handleLongPressEnd}
                onTouchCancel={handleLongPressEnd}
                onContextMenu={(e) => e.preventDefault()}
              >
                <div className="flex items-start gap-3">
                  {canSelect ? (
                    <input
                      type="checkbox"
                      checked={selected.has(invoice.id)}
                      onChange={() => toggleSelect(invoice.id)}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300"
                    />
                  ) : (
                    <div className="mt-1 h-4 w-4 shrink-0" />
                  )}
                  <Link
                    href={`/invoices/${invoice.id}`}
                    className="min-w-0 flex-1 active:opacity-75"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">
                          {invoice.client.name}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {invoice.number ?? "Draft"} · due{" "}
                          {formatDate(invoice.dueDate)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-medium tabular-nums text-slate-900">
                          {formatMoney(invoice.totalCents, invoice.currency)}
                        </p>
                        <span
                          className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[invoice.status]}`}
                        >
                          {STATUS_LABELS[invoice.status]}
                        </span>
                      </div>
                    </div>
                  </Link>
                </div>
              </div>

              {/* Long-press popup */}
              {longPressId === invoice.id ? (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setLongPressId(null)}
                  />
                  <div className="absolute right-4 top-12 z-40 w-40 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                    {invoice.status === "paid" ? (
                      <button
                        type="button"
                        onClick={() => quickToggle(invoice)}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-slate-700 active:bg-red-50"
                      >
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
                        Mark unpaid
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => quickToggle(invoice)}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-slate-700 active:bg-emerald-50"
                      >
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        Mark paid
                      </button>
                    )}
                  </div>
                </>
              ) : null}
            </li>
          );
        })}
      </ul>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white sm:block">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left">
            <tr className="text-xs uppercase tracking-wide text-slate-500">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={
                    selectable.length > 0 &&
                    selected.size === selectable.length
                  }
                  onChange={selectAll}
                  className="h-4 w-4 rounded border-slate-300"
                />
              </th>
              <th className="px-4 py-3 font-medium">Number</th>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Issued</th>
              <th className="px-4 py-3 font-medium">Due</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => {
              const canSelect =
                invoice.status !== "draft" && invoice.status !== "void";
              return (
                <tr
                  key={invoice.id}
                  className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 ${
                    selected.has(invoice.id) ? "bg-blue-50/50" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    {canSelect ? (
                      <input
                        type="checkbox"
                        checked={selected.has(invoice.id)}
                        onChange={() => toggleSelect(invoice.id)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/invoices/${invoice.id}`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {invoice.number ?? "Draft"}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{invoice.client.name}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {formatDate(invoice.issueDate)}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {formatDate(invoice.dueDate)}
                  </td>
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
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
