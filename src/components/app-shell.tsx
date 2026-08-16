import Link from "next/link";

import { SignOutButton } from "@/components/sign-out-button";
import type { Organization, SessionLike } from "@/components/types";

const NAV = [
  { href: "/invoices", label: "Invoices" },
  { href: "/clients", label: "Clients" },
  { href: "/settings/organization", label: "Settings" },
];

export function AppShell({
  org,
  user,
  current,
  children,
}: {
  org: Organization;
  user: SessionLike;
  current: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-8">
            <Link href="/invoices" className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
                IB
              </span>
              <span className="text-sm font-semibold">InvoiceBro</span>
            </Link>

            <nav className="flex items-center gap-1">
              {NAV.map((item) => {
                const active = current.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-md px-3 py-1.5 text-sm transition ${
                      active
                        ? "bg-slate-100 font-medium text-slate-900"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-medium text-slate-900">{org.name}</p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
