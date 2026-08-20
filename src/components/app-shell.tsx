import Link from "next/link";

import { SignOutButton } from "@/components/sign-out-button";
import type { Organization, SessionLike } from "@/components/types";

const NAV = [
  { href: "/invoices", label: "Invoices", icon: InvoiceIcon },
  { href: "/clients", label: "Clients", icon: ClientsIcon },
  { href: "/metrics", label: "Metrics", icon: MetricsIcon },
  { href: "/settings/organization", label: "Settings", icon: SettingsIcon },
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
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-8">
            <Link href="/invoices" className="flex shrink-0 items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
                IB
              </span>
              <span className="text-sm font-semibold">InvoiceBro</span>
            </Link>

            {/* Desktop nav. On mobile this moves to a bottom bar, where thumbs
                actually reach — a top nav on a phone is the hardest place to
                tap on a large screen. */}
            <nav className="hidden items-center gap-1 sm:flex">
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

          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-xs font-medium text-slate-900">{org.name}</p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* pb-24 leaves room for the fixed bottom nav so the last row of content
          is never hidden behind it. */}
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:pb-12 sm:pt-8">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        <div className="flex">
          {NAV.map((item) => {
            const active = current.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs transition ${
                  active ? "font-medium text-blue-700" : "text-slate-500"
                }`}
              >
                <Icon />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function InvoiceIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8M8 11h8M8 15h5M5 3h14v18l-3-2-2 2-2-2-2 2-3-2V3Z" />
    </svg>
  );
}

function ClientsIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M12 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0ZM22 20v-1a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function MetricsIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 16l4-4 4 4 5-6" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}
