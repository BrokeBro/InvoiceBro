import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InvoiceBro",
  description: "Simple invoicing with a PDF that looks like you meant it.",
};

/**
 * Without this, phones assume a ~980px desktop layout and zoom out, which is
 * what makes an otherwise responsive app feel broken on mobile.
 *
 * `maximumScale` is deliberately left alone: blocking pinch-zoom is an
 * accessibility failure, and the 16px inputs already stop iOS auto-zooming on
 * focus, which is the actual annoyance people are trying to fix when they
 * disable it.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
