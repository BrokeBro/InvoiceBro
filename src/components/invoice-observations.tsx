"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { addObservation, deleteObservation } from "@/app/actions/observations";
import type { InvoiceObservation, ObservationTemplate } from "@/lib/types";

export function InvoiceObservations({
  invoiceId,
  observations,
  templates,
}: {
  invoiceId: string;
  observations: InvoiceObservation[];
  templates: ObservationTemplate[];
}) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Observations
        </h2>
        {templates.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
          >
            {showForm ? "Cancel" : "+ Add observation"}
          </button>
        ) : (
          <a
            href="/settings/observation-templates"
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            Create a template first →
          </a>
        )}
      </div>

      {showForm ? (
        <ObservationForm
          invoiceId={invoiceId}
          templates={templates}
          onDone={() => setShowForm(false)}
        />
      ) : null}

      {observations.length === 0 && !showForm ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
          No observations yet.
        </p>
      ) : null}

      <ul className="space-y-3">
        {observations.map((obs) => (
          <ObservationCard
            key={obs.id}
            invoiceId={invoiceId}
            observation={obs}
          />
        ))}
      </ul>
    </div>
  );
}

function ObservationForm({
  invoiceId,
  templates,
  onDone,
}: {
  invoiceId: string;
  templates: ObservationTemplate[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? "");
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");

  const template = templates.find((t) => t.id === selectedId);

  function handleTemplateChange(id: string) {
    setSelectedId(id);
    setResponses({});
  }

  function submit() {
    setError(null);
    const fd = new FormData();
    fd.set(
      "payload",
      JSON.stringify({ templateId: selectedId, responses, note }),
    );

    startTransition(async () => {
      const result = await addObservation(invoiceId, fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
      <label className="mb-1 block text-xs font-medium text-slate-600">
        Template
      </label>
      <select
        value={selectedId}
        onChange={(e) => handleTemplateChange(e.target.value)}
        className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      {template ? (
        <div className="space-y-4">
          {template.fields.map((field, fi) => (
            <div key={fi}>
              <p className="mb-1.5 text-sm font-medium text-slate-700">
                {field.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {field.options.map((opt) => {
                  const selected = responses[field.label] === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() =>
                        setResponses((prev) => ({
                          ...prev,
                          [field.label]: opt,
                        }))
                      }
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        selected
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-slate-300 text-slate-600 hover:border-slate-400"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Additional notes (optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-1.5 text-xs text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save observation"}
        </button>
      </div>
    </div>
  );
}

function ObservationCard({
  invoiceId,
  observation,
}: {
  invoiceId: string;
  observation: InvoiceObservation;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("Delete this observation?")) return;
    startTransition(async () => {
      await deleteObservation(invoiceId, observation.id);
      router.refresh();
    });
  }

  const entries = Object.entries(observation.responses);

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-start justify-between">
        <p className="text-sm font-medium text-slate-900">
          {observation.templateName}
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={handleDelete}
          className="text-xs text-slate-400 transition hover:text-red-600 disabled:opacity-60"
        >
          Delete
        </button>
      </div>

      {entries.length > 0 ? (
        <dl className="space-y-1">
          {entries.map(([label, value]) => (
            <div key={label} className="flex items-baseline gap-2 text-sm">
              <dt className="text-slate-500">{label}:</dt>
              <dd
                className={`font-medium ${
                  value.toLowerCase() === "poor"
                    ? "text-red-600"
                    : value.toLowerCase() === "fair"
                      ? "text-amber-600"
                      : "text-slate-600"
                }`}
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {observation.note ? (
        <p className="mt-2 border-t border-slate-100 pt-2 text-sm text-slate-600">
          {observation.note}
        </p>
      ) : null}

      <p className="mt-2 text-xs text-slate-400">
        {new Date(observation.createdAt).toLocaleDateString()}
      </p>
    </li>
  );
}
