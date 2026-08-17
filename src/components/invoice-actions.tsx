"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteDraft, issueInvoice, voidInvoice } from "@/app/actions/invoices";
import type { Invoice } from "@/lib/types";

export function InvoiceActions({
  invoice,
  template,
}: {
  invoice: Invoice;
  template: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Something went wrong");
        return;
      }
      router.refresh();
    });
  }

  const editable = invoice.status !== "void";

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <a
          href={`/invoices/${invoice.id}/pdf`}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          View PDF
        </a>
        <a
          href={`/invoices/${invoice.id}/pdf?download=1`}
          download
          className="flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Download
        </a>

        {editable ? (
          <Link
            href={`/invoices/${invoice.id}/edit`}
            className="flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Edit
          </Link>
        ) : null}

        {invoice.status === "draft" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => issueInvoice(invoice.id))}
            className="col-span-2 min-h-11 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60 sm:col-span-1"
          >
            {pending ? "Issuing…" : "Issue invoice"}
          </button>
        ) : null}

        {invoice.status === "draft" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm("Delete this draft? This cannot be undone.")) {
                run(() => deleteDraft(invoice.id));
              }
            }}
            className="col-span-2 min-h-11 rounded-lg px-3 py-2 text-sm text-slate-500 transition hover:text-red-600 disabled:opacity-60 sm:col-span-1"
          >
            Delete
          </button>
        ) : invoice.status !== "void" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm("Void this invoice? It stays on record but is marked void.")) {
                run(() => voidInvoice(invoice.id));
              }
            }}
            className="col-span-2 min-h-11 rounded-lg px-3 py-2 text-sm text-slate-500 transition hover:text-red-600 disabled:opacity-60 sm:col-span-1"
          >
            Void
          </button>
        ) : null}
      </div>

      <p className="text-xs text-slate-400 sm:text-right">PDF template: {template}</p>

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-1.5 text-xs text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
