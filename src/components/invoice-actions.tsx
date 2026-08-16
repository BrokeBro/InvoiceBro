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
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`/invoices/${invoice.id}/pdf`}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          View PDF
        </a>
        <a
          href={`/invoices/${invoice.id}/pdf?download=1`}
          download
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Download
        </a>

        {editable ? (
          <Link
            href={`/invoices/${invoice.id}/edit`}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Edit
          </Link>
        ) : null}

        {invoice.status === "draft" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => issueInvoice(invoice.id))}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
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
            className="rounded-lg px-3 py-2 text-sm text-slate-500 transition hover:text-red-600 disabled:opacity-60"
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
            className="rounded-lg px-3 py-2 text-sm text-slate-500 transition hover:text-red-600 disabled:opacity-60"
          >
            Void
          </button>
        ) : null}
      </div>

      <p className="text-xs text-slate-400">PDF template: {template}</p>

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-1.5 text-xs text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
