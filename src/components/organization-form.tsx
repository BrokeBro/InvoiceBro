"use client";

/* eslint-disable @next/next/no-img-element */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { saveOrganization } from "@/app/actions/organization";
import { CURRENCIES } from "@/lib/defaults";
import { TEMPLATE_IDS, type Organization } from "@/lib/types";

export function OrganizationForm({
  organization,
  logoUrl,
}: {
  organization: Organization;
  logoUrl: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [accent, setAccent] = useState(organization.branding.accentColor);

  function submit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await saveOrganization(formData);
      setMessage(
        result.ok
          ? { ok: true, text: "Settings saved." }
          : { ok: false, text: result.error },
      );
      if (result.ok) router.refresh();
    });
  }

  return (
    <form action={submit} className="space-y-6">
      <Section title="Business details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name" required>
            <input name="name" defaultValue={organization.name} required className={inputClass} />
          </Field>
          <Field label="Email">
            <input
              name="email"
              type="email"
              defaultValue={organization.email}
              className={inputClass}
            />
          </Field>
          <Field label="Phone">
            <input name="phone" defaultValue={organization.phone} className={inputClass} />
          </Field>
          <Field label="VAT number">
            <input
              name="vatNumber"
              defaultValue={organization.vatNumber}
              className={inputClass}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Address">
              <textarea
                name="address"
                rows={3}
                defaultValue={organization.address}
                className={inputClass}
              />
            </Field>
          </div>
        </div>
      </Section>

      <Section title="Branding">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Logo">
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Current logo"
                  className="h-12 w-24 rounded border border-slate-200 bg-white object-contain p-1"
                />
              ) : (
                <div className="flex h-12 w-24 items-center justify-center rounded border border-dashed border-slate-300 text-xs text-slate-400">
                  No logo
                </div>
              )}
              <input
                name="logo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium"
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-400">PNG, JPEG or WebP, up to 2 MB.</p>
          </Field>

          <Field label="Accent colour">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={accent}
                onChange={(event) => setAccent(event.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-slate-300"
              />
              <input
                name="accentColor"
                value={accent}
                onChange={(event) => setAccent(event.target.value)}
                className={inputClass}
              />
            </div>
          </Field>

          <Field label="Default PDF template">
            <select
              name="template"
              defaultValue={organization.branding.template}
              className={inputClass}
            >
              {TEMPLATE_IDS.map((id) => (
                <option key={id} value={id}>
                  {id[0].toUpperCase() + id.slice(1)}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-slate-400">
              Any invoice can override this individually.
            </p>
          </Field>
        </div>
      </Section>

      <Section title="Invoice defaults">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Currency">
            <select
              name="currency"
              defaultValue={organization.defaults.currency}
              className={inputClass}
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tax rate %">
            <input
              name="taxRatePercent"
              type="number"
              step="0.01"
              min="0"
              max="100"
              defaultValue={organization.defaults.taxRatePercent}
              className={inputClass}
            />
          </Field>
          <Field label="Payment terms (days)">
            <input
              name="paymentTermsDays"
              type="number"
              min="0"
              max="365"
              defaultValue={organization.defaults.paymentTermsDays}
              className={inputClass}
            />
          </Field>
          <Field label="Number prefix">
            <input
              name="numberPrefix"
              defaultValue={organization.numbering.prefix}
              className={inputClass}
            />
          </Field>
          <Field label="Number padding">
            <input
              name="numberPadding"
              type="number"
              min="1"
              max="10"
              defaultValue={organization.numbering.padding}
              className={inputClass}
            />
            <p className="mt-1.5 text-xs text-slate-400">
              Next: {organization.numbering.prefix}
              {String(organization.numbering.next).padStart(organization.numbering.padding, "0")}
            </p>
          </Field>
          <div className="sm:col-span-2 lg:col-span-3">
            <Field label="Default notes">
              <textarea
                name="defaultNotes"
                rows={2}
                defaultValue={organization.defaults.notes}
                placeholder="Thanks for your business!"
                className={inputClass}
              />
            </Field>
          </div>
        </div>
      </Section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 w-full rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60 sm:w-auto sm:py-2"
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
        {message ? (
          <span className={`text-sm ${message.ok ? "text-emerald-600" : "text-red-600"}`}>
            {message.text}
          </span>
        ) : null}
      </div>
    </form>
  );
}

// text-base (16px) on mobile is deliberate: iOS Safari zooms the whole page
// when a focused input is smaller than 16px, which is jarring and leaves the
// layout shifted. sm:text-sm restores the tighter desktop scale.
// min-h-11 keeps every control at a comfortable ~44px tap target.
const inputClass =
  "w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:min-h-0 sm:py-2 sm:text-sm";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="mb-4 text-sm font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

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
