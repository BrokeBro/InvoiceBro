"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";

import { parseImportedInvoice, saveImportedInvoice } from "@/app/actions/import";
import type { ImportedInvoiceData } from "@/lib/import-parser";

type ClientOption = { id: string; name: string };

type Step = "upload" | "review" | "done";

export function InvoiceImporter({
  clients,
  defaultCurrency,
}: {
  clients: ClientOption[];
  defaultCurrency: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [parsed, setParsed] = useState<ImportedInvoiceData | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  return (
    <div>
      {step === "upload" ? (
        <UploadStep
          error={error}
          pending={pending}
          onUpload={(f) => {
            setError(null);
            setFile(f);
            const fd = new FormData();
            fd.set("file", f);
            startTransition(async () => {
              const result = await parseImportedInvoice(fd);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setParsed(result.data);
              setStep("review");
            });
          }}
        />
      ) : step === "review" && parsed ? (
        <ReviewStep
          data={parsed}
          clients={clients}
          defaultCurrency={defaultCurrency}
          file={file}
          error={error}
          pending={pending}
          onSave={(payload, originalFile) => {
            setError(null);
            const fd = new FormData();
            fd.set("payload", JSON.stringify(payload));
            if (originalFile) fd.set("file", originalFile);
            startTransition(async () => {
              const result = await saveImportedInvoice(fd);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setCreatedId(result.data.invoiceId);
              setStep("done");
            });
          }}
          onBack={() => {
            setStep("upload");
            setError(null);
          }}
        />
      ) : step === "done" ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
          <p className="text-lg font-medium text-green-800">Invoice imported successfully</p>
          <div className="mt-4 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => router.push(`/invoices/${createdId}`)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              View invoice
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("upload");
                setParsed(null);
                setFile(null);
                setError(null);
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Import another
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Upload step ──────────────────────────────────────────────────────────

function UploadStep({
  error,
  pending,
  onUpload,
}: {
  error: string | null;
  pending: boolean;
  onUpload: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(
    (f: File) => {
      if (f.type !== "application/pdf") {
        return;
      }
      onUpload(f);
    },
    [onUpload],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) handleFile(f);
      }}
      className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-16 transition ${
        dragging
          ? "border-blue-400 bg-blue-50"
          : "border-slate-300 bg-white"
      }`}
    >
      <svg className="mb-4 h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>

      <p className="mb-1 text-sm font-medium text-slate-700">
        {pending ? "Reading PDF…" : "Drop a PDF invoice here"}
      </p>
      <p className="mb-4 text-xs text-slate-500">
        or click to browse — the invoice will be parsed so you can review it
      </p>

      <button
        type="button"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Parsing…" : "Choose PDF"}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      {error ? (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-1.5 text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// ── Review step ──────────────────────────────────────────────────────────

function ReviewStep({
  data,
  clients,
  defaultCurrency,
  file,
  error,
  pending,
  onSave,
  onBack,
}: {
  data: ImportedInvoiceData;
  clients: ClientOption[];
  defaultCurrency: string;
  file: File | null;
  error: string | null;
  pending: boolean;
  onSave: (payload: Record<string, unknown>, file: File | null) => void;
  onBack: () => void;
}) {
  const [invoiceNumber, setInvoiceNumber] = useState(data.invoiceNumber ?? "");
  const [issueDate, setIssueDate] = useState(data.issueDate ?? "");
  const [dueDate, setDueDate] = useState(data.dueDate ?? "");
  const [currency, setCurrency] = useState(data.currency || defaultCurrency);
  const [status, setStatus] = useState<"draft" | "sent" | "paid">("sent");
  const [notes, setNotes] = useState(data.notes);
  const [terms, setTerms] = useState("");

  // Client matching
  const autoMatched = clients.find(
    (c) => c.name.toLowerCase() === (data.clientName ?? "").toLowerCase(),
  );
  const [clientMode, setClientMode] = useState<"existing" | "new">(
    autoMatched ? "existing" : "new",
  );
  const [selectedClientId, setSelectedClientId] = useState(autoMatched?.id ?? (clients[0]?.id || ""));
  const [clientName, setClientName] = useState(data.clientName ?? "");
  const [clientEmail, setClientEmail] = useState(data.clientEmail ?? "");
  const [clientAddress, setClientAddress] = useState(data.clientAddress ?? "");

  // Line items
  const [lineItems, setLineItems] = useState(
    data.lineItems.map((li, i) => ({ ...li, key: i })),
  );
  let nextKey = useRef(data.lineItems.length);

  function updateLine(index: number, field: string, value: string | number) {
    setLineItems((prev) =>
      prev.map((li, i) => (i === index ? { ...li, [field]: value } : li)),
    );
  }

  function removeLine(index: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  function addLine() {
    setLineItems((prev) => [
      ...prev,
      { description: "", quantity: 1, unitPriceCents: 0, taxRatePercent: 0, key: nextKey.current++ },
    ]);
  }

  function handleSave() {
    onSave(
      {
        invoiceNumber,
        issueDate,
        dueDate,
        currency,
        clientId: clientMode === "existing" ? selectedClientId : null,
        clientName,
        clientEmail,
        clientAddress,
        lineItems: lineItems.map(({ key: _key, ...rest }) => rest),
        notes,
        terms,
        status,
        fileName: file?.name ?? "imported.pdf",
      },
      file,
    );
  }

  const subtotalCents = lineItems.reduce(
    (sum, li) => sum + li.quantity * li.unitPriceCents,
    0,
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        Review the parsed data below and correct anything that looks wrong before saving.
        {autoMatched ? (
          <span className="font-medium"> Auto-matched client: {autoMatched.name}.</span>
        ) : null}
      </div>

      {/* Invoice details */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Invoice Details
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Invoice Number">
            <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Issue Date">
            <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Due Date">
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Currency">
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClass}>
              <option value="GBP">GBP (£)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
            </select>
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Status">
            <div className="flex gap-4">
              {(["sent", "paid", "draft"] as const).map((s) => (
                <label key={s} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="status"
                    value={s}
                    checked={status === s}
                    onChange={() => setStatus(s)}
                    className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="capitalize">{s}</span>
                </label>
              ))}
            </div>
          </Field>
        </div>
      </section>

      {/* Client */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Client
        </h2>

        <div className="mb-4 flex gap-4">
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name="clientMode"
              checked={clientMode === "existing"}
              onChange={() => setClientMode("existing")}
              className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Existing client
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name="clientMode"
              checked={clientMode === "new"}
              onChange={() => setClientMode("new")}
              className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Create new client
          </label>
        </div>

        {clientMode === "existing" ? (
          <Field label="Select Client">
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className={inputClass}
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Client Name">
              <input value={clientName} onChange={(e) => setClientName(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Email">
              <input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className={inputClass} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Address">
                <input value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} className={inputClass} />
              </Field>
            </div>
          </div>
        )}
      </section>

      {/* Line items */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Line Items
        </h2>

        {lineItems.length === 0 ? (
          <p className="text-sm text-slate-500">No line items parsed — add them manually.</p>
        ) : null}

        <div className="space-y-3">
          {lineItems.map((li, i) => (
            <div key={li.key} className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
              <div className="min-w-[200px] flex-1">
                <label className="mb-1 block text-xs text-slate-500">Description</label>
                <input
                  value={li.description}
                  onChange={(e) => updateLine(i, "description", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="w-20">
                <label className="mb-1 block text-xs text-slate-500">Qty</label>
                <input
                  type="number"
                  min={1}
                  value={li.quantity}
                  onChange={(e) => updateLine(i, "quantity", parseInt(e.target.value) || 1)}
                  className={inputClass}
                />
              </div>
              <div className="w-28">
                <label className="mb-1 block text-xs text-slate-500">Unit Price (pence)</label>
                <input
                  type="number"
                  min={0}
                  value={li.unitPriceCents}
                  onChange={(e) => updateLine(i, "unitPriceCents", parseInt(e.target.value) || 0)}
                  className={inputClass}
                />
              </div>
              <div className="w-20">
                <label className="mb-1 block text-xs text-slate-500">Tax %</label>
                <input
                  type="number"
                  min={0}
                  value={li.taxRatePercent}
                  onChange={(e) => updateLine(i, "taxRatePercent", parseFloat(e.target.value) || 0)}
                  className={inputClass}
                />
              </div>
              <button
                type="button"
                onClick={() => removeLine(i)}
                className="mb-0.5 text-xs text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addLine}
          className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          + Add line item
        </button>

        <div className="mt-4 text-right text-sm text-slate-600">
          Subtotal: {(subtotalCents / 100).toFixed(2)}
        </div>
      </section>

      {/* Notes */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
          </Field>
          <Field label="Terms">
            <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={2} className={inputClass} />
          </Field>
        </div>
      </section>

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-1.5 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={pending}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Import Invoice"}
        </button>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}
