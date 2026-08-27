"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  deleteArchivedInvoice,
  uploadArchivedInvoice,
} from "@/app/actions/archive";
import { formatDate } from "@/lib/dates";
import type { ArchivedInvoice } from "@/lib/types";

type SortField = "date" | "name" | "uploaded";
type ArchivedWithUrl = ArchivedInvoice & { url: string | null };

export function ArchiveManager({
  invoices,
}: {
  invoices: ArchivedWithUrl[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [sortBy, setSortBy] = useState<SortField>("uploaded");
  const [sortAsc, setSortAsc] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const sorted = [...invoices].sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case "date": {
        const da = a.detectedDate ?? "";
        const db = b.detectedDate ?? "";
        cmp = da.localeCompare(db);
        break;
      }
      case "name":
        cmp = a.fileName.localeCompare(b.fileName);
        break;
      case "uploaded":
        cmp = a.createdAt.localeCompare(b.createdAt);
        break;
    }
    return sortAsc ? cmp : -cmp;
  });

  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(field);
      setSortAsc(false);
    }
  }

  function sortArrow(field: SortField) {
    if (sortBy !== field) return "";
    return sortAsc ? " ↑" : " ↓";
  }

  function uploadFiles(files: FileList | File[]) {
    setMessage(null);
    const fileArr = Array.from(files);
    if (fileArr.length === 0) return;

    startTransition(async () => {
      let uploaded = 0;
      let lastError = "";
      for (const file of fileArr) {
        const fd = new FormData();
        fd.set("file", file);
        const result = await uploadArchivedInvoice(fd);
        if (result.ok) {
          uploaded++;
        } else {
          lastError = result.error;
        }
      }

      if (uploaded > 0) {
        setMessage({
          ok: true,
          text: `${uploaded} file${uploaded > 1 ? "s" : ""} uploaded.`,
        });
        router.refresh();
      } else {
        setMessage({ ok: false, text: lastError || "Upload failed" });
      }
    });
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}" from the archive?`)) return;
    setMessage(null);
    startTransition(async () => {
      const result = await deleteArchivedInvoice(id);
      if (result.ok) {
        setMessage({ ok: true, text: "Deleted." });
        router.refresh();
      } else {
        setMessage({ ok: false, text: result.error });
      }
    });
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Archive</h1>
          <p className="mt-1 text-sm text-slate-500">
            Store invoices from other systems. Dates are detected from filenames automatically.
          </p>
        </div>
      </div>

      {/* Upload zone */}
      <label
        className={`mb-6 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
          dragOver
            ? "border-blue-400 bg-blue-50"
            : "border-slate-300 bg-white hover:border-slate-400"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
        }}
      >
        <svg
          className="mb-2 h-8 w-8 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 16V4m0 0L8 8m4-4 4 4M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2"
          />
        </svg>
        <p className="text-sm font-medium text-slate-700">
          {pending ? "Uploading…" : "Drop files here or tap to upload"}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          PDF, PNG, JPEG or WebP · up to 10 MB each
        </p>
        <input
          type="file"
          multiple
          accept="application/pdf,image/png,image/jpeg,image/webp"
          className="hidden"
          disabled={pending}
          onChange={(e) => {
            if (e.target.files) uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {message ? (
        <p
          className={`mb-4 rounded-lg px-4 py-2 text-sm ${
            message.ok
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <h2 className="text-base font-medium text-slate-900">No archived invoices</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
            Upload invoices from other systems to keep them organised in one place.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="mb-3 flex gap-1.5 sm:hidden">
            {(["uploaded", "date", "name"] as SortField[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => handleSort(f)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                  sortBy === f
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200"
                }`}
              >
                {f === "uploaded" ? "Uploaded" : f === "date" ? "Date" : "Name"}
                {sortArrow(f)}
              </button>
            ))}
          </div>

          <ul className="space-y-2 sm:hidden">
            {sorted.map((doc) => (
              <li
                key={doc.id}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {doc.fileName}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                      {doc.detectedDate ? (
                        <span>Date: {formatDate(doc.detectedDate)}</span>
                      ) : (
                        <span className="text-slate-400">No date detected</span>
                      )}
                      <span>{(doc.sizeBytes / 1024).toFixed(0)} KB</span>
                    </div>
                    {doc.notes ? (
                      <p className="mt-1 text-xs text-slate-400">{doc.notes}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {doc.url ? (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
                      >
                        <ViewIcon />
                      </a>
                    ) : null}
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleDelete(doc.id, doc.fileName)}
                      className="rounded-lg border border-slate-200 p-2 text-slate-400 transition hover:text-red-600 disabled:opacity-60"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white sm:block">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left">
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th
                    className="cursor-pointer px-4 py-3 font-medium hover:text-slate-900"
                    onClick={() => handleSort("name")}
                  >
                    File name{sortArrow("name")}
                  </th>
                  <th
                    className="cursor-pointer px-4 py-3 font-medium hover:text-slate-900"
                    onClick={() => handleSort("date")}
                  >
                    Invoice date{sortArrow("date")}
                  </th>
                  <th className="px-4 py-3 font-medium">Size</th>
                  <th
                    className="cursor-pointer px-4 py-3 font-medium hover:text-slate-900"
                    onClick={() => handleSort("uploaded")}
                  >
                    Uploaded{sortArrow("uploaded")}
                  </th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((doc) => (
                  <tr
                    key={doc.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >
                    <td className="max-w-xs truncate px-4 py-3 font-medium text-slate-900">
                      {doc.fileName}
                      {doc.notes ? (
                        <span className="ml-2 text-xs font-normal text-slate-400">
                          {doc.notes}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {doc.detectedDate ? (
                        formatDate(doc.detectedDate)
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 tabular-nums">
                      {(doc.sizeBytes / 1024).toFixed(0)} KB
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {formatDate(doc.createdAt.slice(0, 10))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {doc.url ? (
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg px-2 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-50"
                          >
                            View
                          </a>
                        ) : null}
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => handleDelete(doc.id, doc.fileName)}
                          className="rounded-lg px-2 py-1 text-xs text-slate-400 transition hover:text-red-600 disabled:opacity-60"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function ViewIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6M4 7h16M10 3h4a1 1 0 0 1 1 1v1H9V4a1 1 0 0 1 1-1Z" />
    </svg>
  );
}
