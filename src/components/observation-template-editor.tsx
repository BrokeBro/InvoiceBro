"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  deleteObservationTemplate,
  saveObservationTemplate,
} from "@/app/actions/observations";
import type { ObservationTemplate } from "@/lib/types";

type Field = { key: string; label: string; options: string[] };

let fieldCounter = 0;
function newField(): Field {
  return { key: `f-${++fieldCounter}`, label: "", options: ["Poor", "Fair", "Unused"] };
}

export function ObservationTemplateList({
  templates,
}: {
  templates: ObservationTemplate[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<ObservationTemplate | "new" | null>(null);

  function handleDelete(id: string) {
    if (!confirm("Delete this template?")) return;
    startTransition(async () => {
      await deleteObservationTemplate(id);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Observation templates</h2>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          New template
        </button>
      </div>

      {templates.length === 0 && !editing ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          No observation templates yet. Create one to start adding observations to
          invoices.
        </p>
      ) : null}

      <ul className="space-y-3">
        {templates.map((t) => (
          <li
            key={t.id}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">{t.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {t.fields.length} field{t.fields.length === 1 ? "" : "s"}
                </p>
                <ul className="mt-2 space-y-1">
                  {t.fields.map((f, i) => (
                    <li key={i} className="text-sm text-slate-600">
                      <span className="font-medium">{f.label}</span>{" "}
                      <span className="text-slate-400">— {f.options.join(" · ")}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(t)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  Edit
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleDelete(t.id)}
                  className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                >
                  Delete
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {editing ? (
        <TemplateForm
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function TemplateForm({
  initial,
  onClose,
}: {
  initial: ObservationTemplate | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initial?.name ?? "");
  const [fields, setFields] = useState<Field[]>(() =>
    initial
      ? initial.fields.map((f, i) => ({
          key: `e-${i}`,
          label: f.label,
          options: [...f.options],
        }))
      : [newField()],
  );

  function updateField(key: string, patch: Partial<Field>) {
    setFields((prev) =>
      prev.map((f) => (f.key === key ? { ...f, ...patch } : f)),
    );
  }

  function addOption(key: string) {
    setFields((prev) =>
      prev.map((f) =>
        f.key === key ? { ...f, options: [...f.options, ""] } : f,
      ),
    );
  }

  function updateOption(key: string, index: number, value: string) {
    setFields((prev) =>
      prev.map((f) => {
        if (f.key !== key) return f;
        const opts = [...f.options];
        opts[index] = value;
        return { ...f, options: opts };
      }),
    );
  }

  function removeOption(key: string, index: number) {
    setFields((prev) =>
      prev.map((f) => {
        if (f.key !== key || f.options.length <= 2) return f;
        return { ...f, options: f.options.filter((_, i) => i !== index) };
      }),
    );
  }

  function removeField(key: string) {
    setFields((prev) => prev.filter((f) => f.key !== key));
  }

  function submit() {
    setError(null);
    const payload = {
      name: name.trim(),
      fields: fields
        .filter((f) => f.label.trim())
        .map((f) => ({
          label: f.label.trim(),
          options: f.options.map((o) => o.trim()).filter(Boolean),
        })),
    };

    const fd = new FormData();
    fd.set("payload", JSON.stringify(payload));

    startTransition(async () => {
      const result = await saveObservationTemplate(initial?.id ?? null, fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-16">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold">
          {initial ? "Edit template" : "New observation template"}
        </h3>

        <label className="mb-1 block text-sm font-medium text-slate-700">
          Template name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. End-of-tenancy check"
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />

        <p className="mb-2 text-sm font-medium text-slate-700">Fields</p>
        <div className="space-y-4">
          {fields.map((field) => (
            <div
              key={field.key}
              className="rounded-lg border border-slate-200 bg-slate-50 p-3"
            >
              <div className="mb-2 flex items-center gap-2">
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) =>
                    updateField(field.key, { label: e.target.value })
                  }
                  placeholder="Field label, e.g. Bedroom 1 cleanliness"
                  className="flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {fields.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeField(field.key)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                ) : null}
              </div>

              <p className="mb-1 text-xs text-slate-500">Options (min 2)</p>
              <div className="flex flex-wrap gap-1.5">
                {field.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) =>
                        updateOption(field.key, i, e.target.value)
                      }
                      className="w-24 rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    {field.options.length > 2 ? (
                      <button
                        type="button"
                        onClick={() => removeOption(field.key, i)}
                        className="text-slate-400 hover:text-red-500"
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addOption(field.key)}
                  className="rounded-md border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-500 hover:border-blue-400 hover:text-blue-600"
                >
                  + Option
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setFields((prev) => [...prev, newField()])}
          className="mt-3 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 transition hover:border-blue-400 hover:text-blue-600"
        >
          + Add field
        </button>

        {error ? (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-1.5 text-xs text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={submit}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save template"}
          </button>
        </div>
      </div>
    </div>
  );
}
