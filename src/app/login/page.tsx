import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { LoginButton } from "@/app/login/login-button";

export const metadata = { title: "Sign in · InvoiceBro" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  if (await getSessionUser()) redirect(next ?? "/invoices");

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-xl font-bold text-white">
              IB
            </div>
            <h1 className="text-xl font-semibold text-slate-900">InvoiceBro</h1>
            <p className="mt-1 text-sm text-slate-500">
              Invoices that look like you meant it.
            </p>
          </div>

          <LoginButton next={next} />

          <p className="mt-6 text-center text-xs text-slate-400">
            Signing in creates your workspace automatically.
          </p>
        </div>
      </div>
    </main>
  );
}
