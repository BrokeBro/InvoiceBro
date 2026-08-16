"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { archiveClient, saveClient } from "@/app/actions/clients";
import { CURRENCIES } from "@/lib/defaults";
import type { Client } from "@/lib/types";

export function ClientManager({
  clients,
  defaultCurrency,
}: {
  clients: Client[];
  defaultCurrency: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Client | null | undefined>(undefined);

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
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
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
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

              <div className="mt-4 flex gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setEditing(client)}
                  className="text-blue-700 hover:underline"
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
  onClose,
  onSaved,
}: {
  client: Client | null;
  defaultCurrency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
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

          <div className="grid grid-cols-2 gap-3">
            <Field label="VAT number">
              <input
                name="vatNumber"
                defaultValue={client?.vatNumber ?? ""}
                className={inputClass}
              />
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

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

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
