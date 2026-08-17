"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { archiveClient, saveClient } from "@/app/actions/clients";
import { CURRENCIES } from "@/lib/defaults";
import type { Client } from "@/lib/types";

export function ClientManager({
  clients,
  defaultCurrency,
  defaultTaxRate,
}: {
  clients: Client[];
  defaultCurrency: string;
  defaultTaxRate: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Client | null | undefined>(undefined);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="mt-1 text-sm text-slate-500">
            {clients.length === 0
              ? "Nobody to bill yet."
              : `${clients.length} client${clients.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(null)}
          className="min-h-11 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 sm:w-auto"
        >
          Add client
        </button>
      </div>

      {clients.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <h2 className="text-base font-medium">No clients yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
            Add the people or companies you invoice. Their details are copied onto
            each invoice at the moment you issue it.
          </p>
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            Add your first client
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <div
              key={client.id}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{client.name}</p>
                  {client.email ? (
                    <p className="truncate text-sm text-slate-500">{client.email}</p>
                  ) : null}
                </div>
                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                  {client.currency}
                </span>
              </div>

              {client.address ? (
                <p className="mt-2 line-clamp-2 whitespace-pre-line text-xs text-slate-500">
                  {client.address}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                  {client.taxRatePercent === null
                    ? `VAT ${defaultTaxRate}% (default)`
                    : `VAT ${client.taxRatePercent}%`}
                </span>
                {!client.vatRegistered ? (
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">
                    Not VAT registered
                  </span>
                ) : null}
              </div>

              <div className="mt-4 flex gap-4 text-xs">
                <button
                  type="button"
                  onClick={() => setEditing(client)}
                  className="min-h-9 font-medium text-blue-700 hover:underline"
                >
                  Edit
                </button>
                <ArchiveButton
                  clientId={client.id}
                  name={client.name}
                  onDone={() => router.refresh()}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {editing !== undefined ? (
        <ClientDialog
          client={editing}
          defaultCurrency={defaultCurrency}
          defaultTaxRate={defaultTaxRate}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function ArchiveButton({
  clientId,
  name,
  onDone,
}: {
  clientId: string;
  name: string;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Archive ${name}? Existing invoices keep their details.`)) return;
        startTransition(async () => {
          await archiveClient(clientId);
          onDone();
        });
      }}
      className="text-slate-400 transition hover:text-red-600 disabled:opacity-50"
    >
      {pending ? "…" : "Archive"}
    </button>
  );
}

function ClientDialog({
  client,
  defaultCurrency,
  defaultTaxRate,
  onClose,
  onSaved,
}: {
  client: Client | null;
  defaultCurrency: string;
  defaultTaxRate: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Controlled so the VAT number field can appear and disappear as it is toggled.
  const [vatRegistered, setVatRegistered] = useState(client?.vatRegistered ?? false);

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await saveClient(client?.id ?? null, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-900/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-h-[90vh] sm:rounded-2xl sm:p-6">
        <h2 className="mb-4 text-lg font-semibold">
          {client ? "Edit client" : "New client"}
        </h2>

        <form action={submit} className="space-y-4">
          <Field label="Name" required>
            <input
              name="name"
              defaultValue={client?.name ?? ""}
              required
              autoFocus
              className={inputClass}
            />
          </Field>

          <Field label="Email">
            <input
              name="email"
              type="email"
              defaultValue={client?.email ?? ""}
              className={inputClass}
            />
          </Field>

          <Field label="Address">
            <textarea
              name="address"
              rows={3}
              defaultValue={client?.address ?? ""}
              className={inputClass}
            />
          </Field>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <label className="flex min-h-11 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                name="vatRegistered"
                checked={vatRegistered}
                onChange={(event) => setVatRegistered(event.target.checked)}
                className="h-5 w-5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-700">
                This client is VAT registered
              </span>
            </label>

            {vatRegistered ? (
              <div className="mt-3">
                <Field label="Their VAT number">
                  <input
                    name="vatNumber"
                    defaultValue={client?.vatNumber ?? ""}
                    placeholder="GB 123 4567 89"
                    className={inputClass}
                  />
                </Field>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                No VAT number will appear under their address on the invoice.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="VAT / tax rate">
              <input
                name="taxRatePercent"
                type="number"
                step="0.01"
                min="0"
                max="100"
                inputMode="decimal"
                defaultValue={client?.taxRatePercent ?? ""}
                placeholder={`Default (${defaultTaxRate}%)`}
                className={inputClass}
              />
              <p className="mt-1.5 text-xs text-slate-500">
                Leave blank to use your default. Set 0 for charities, exports or
                anyone zero-rated.
              </p>
            </Field>
            <Field label="Currency">
              <select
                name="currency"
                defaultValue={client?.currency ?? defaultCurrency}
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

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-lg px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="min-h-11 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// text-base (16px) on mobile is deliberate: iOS Safari zooms the whole page
// when a focused input is smaller than 16px, which is jarring and leaves the
// layout shifted. sm:text-sm restores the tighter desktop scale.
// min-h-11 keeps every control at a comfortable ~44px tap target.
const inputClass =
  "w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:min-h-0 sm:py-2 sm:text-sm";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-600">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      {children}
    </label>
  );
}
