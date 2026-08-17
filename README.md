# InvoiceBro

Web-based invoicing with a PDF that looks like you meant it. Next.js on Vercel,
Firebase for auth, data and files.

## Why this is a fresh build

Two open-source invoicing projects were evaluated as a starting point:

- **[InvoiceShelf](https://github.com/InvoiceShelf/InvoiceShelf)** — PHP 8.4 /
  Laravel, PDF via dompdf and Gotenberg. Vercel has no PHP runtime, no
  persistent filesystem and no queue workers, so it cannot be deployed there.
- **[Invoicerr](https://github.com/invoicerr-app/invoicerr)** — NestJS + React +
  Prisma, PDF via Puppeteer and Handlebars. Architecturally closer, but it is a
  long-running server with SQLite by default, and Puppeteer on Vercel serverless
  needs `@sparticuz/chromium` and fights bundle-size and cold-start limits.

Both are **AGPL-3.0**, whose copyleft triggers on *network use* — hosting code
derived from either would oblige us to publish our source to every user.

So InvoiceBro is written from scratch. Their data models, invoice status
lifecycles and PDF layouts informed the design; none of their code is used, and
InvoiceBro's licence remains entirely the owner's choice.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router), TypeScript, Tailwind 4 |
| Auth | Firebase Auth — Google sign-in only |
| Database | Cloud Firestore (via Admin SDK, server-side only) |
| Files | Firebase Cloud Storage (logos) |
| PDF | `@react-pdf/renderer`, three templates, rendered in-process |
| Hosting | Vercel |

## Architecture

**Every Firestore and Storage access goes through the Next.js server using the
Admin SDK. The browser never touches the database.** Firestore and Storage rules
are locked to deny-all as defence in depth.

This is the load-bearing decision. Tenant isolation becomes a single
authorization check — `requireOrg()` in `src/lib/auth.ts` — that is ordinary,
testable code, rather than logic spread across security-rule expressions. It
also lets the future public invoice portal read one invoice without exposing
anything else.

Firestore is NoSQL and invoicing is relational-shaped, so the schema works with
the grain:

- **Line items are embedded** in the invoice document. An invoice is always read
  and written whole, which is exactly Firestore's strength.
- **Client details are snapshotted onto the invoice.** Correct accounting
  behaviour regardless of database — editing a client's address must never
  retroactively alter an invoice already sent — and it removes joins on read.
- **Money is integer minor units** (`amountCents`), never floats. All arithmetic
  lives in `src/lib/money.ts`.
- **Invoice numbers** come from a transaction on the org's counter. Unique and
  ascending; a gap can appear if a draft is abandoned after issuing.
- **Status is derived**, never stored-and-stale. `overdue` is computed at read
  time, so there is no nightly job that can fail and leave invoices wrong.

## Setup

### 1. Firebase console

Project `invoicebro-e0c83` already exists. Three things must be enabled:

1. **Authentication → Sign-in method → Google**: enable it.
2. **Firestore Database → Create database** (production mode).
3. **Project settings → Service accounts → Generate new private key**.

Also add your deployment domain under **Authentication → Settings → Authorized
domains**, or Google sign-in works locally but fails in production.

### 2. Environment

```bash
cp .env.example .env.local
```

The `NEXT_PUBLIC_FIREBASE_*` values are already filled in — Firebase client
config is public by design; the `apiKey` identifies the project and grants
nothing on its own.

`FIREBASE_SERVICE_ACCOUNT_KEY` is the one real secret: it bypasses every
security rule. Base64-encode the JSON you downloaded and set it:

```bash
base64 -w0 serviceAccountKey.json    # macOS: base64 -i serviceAccountKey.json
```

### 3. Run

```bash
npm install
npm run dev
```

### 4. Deploy

Import the repo into Vercel and set the same environment variables. Nothing else
is required — the PDF route already pins the `nodejs` runtime.

Deploy the rules once, from the Firebase console or the CLI:

```bash
firebase deploy --only firestore:rules,storage:rules
```

## Dependency override: `jose` pinned to v5

`package.json` pins `jose` to `^5.10.0` via `overrides`. This is deliberate and
should be removed once it is no longer needed.

`firebase-admin@14` depends on `jwks-rsa@4`, which is CommonJS and does a plain
`require('jose')` on the first line of `src/utils.js`. `jose@6` is ESM-only and
ships **no CommonJS build** — its sole export condition is
`"default": "./dist/webapi/index.js"`. Any runtime that cannot `require()` an ES
module therefore fails at import time with:

```
Failed to load external module firebase-admin-…/auth:
ERR_REQUIRE_ESM: require() of ES Module .../jose/dist/webapi/index.js
                 from .../jwks-rsa/src/utils.js not supported
```

This passed locally and 500'd every request in production, because Node ≥22.12
can `require()` a synchronous ES module graph and the deployed Lambda could not.
Raising the Node version does **not** fix it — the Vercel project was already on
Node 24.x when this happened.

`jose@5.10.0` ships a real CJS build (`"require": "./dist/node/cjs/index.js"`),
so the `require` resolves normally and the failure mode disappears on every
runtime. `jwks-rsa` uses exactly two jose APIs — `importJWK` and `exportSPKI` —
both present in v5, and it is the only package that depends on jose at all.

It *is* a semver override (`jwks-rsa` asks for `^6.1.3`). Drop it when
`jwks-rsa` ships a CJS-safe release or moves to `import()`.

To reproduce the original failure on Node 22, disable the `require(esm)`
behaviour that masks it locally:

```bash
node --no-experimental-require-module -e "require('firebase-admin/auth')"
```

That must succeed. If it throws `ERR_REQUIRE_ESM`, the override has been lost.

## Verifying against live Firebase

```bash
npm run smoke
```

Drives every server-side path against the real Firestore project using the
application's own modules — not reimplementations, so a failure here is a real
failure in shipped code. It covers connectivity and org bootstrap, the tenancy
boundary (including the negative case: a non-member must be refused), the
client/invoice round-trip, derived status transitions, mixed-rate tax
arithmetic, concurrent invoice-number reservation, and PDF rendering from live
data. It creates a throwaway org and deletes everything afterwards, including on
failure.

Google sign-in itself needs a browser and a real Google account, so it's the one
thing the script can't cover. Run `npm run dev` and sign in to exercise it.

## Working on the PDF templates

```bash
npm run pdf:preview
```

Renders all three templates to `.preview/` with realistic sample data — mixed
tax rates, long descriptions, and enough lines to force a page break — with no
Firebase credentials needed, so template work never waits on the console.

### Two react-pdf traps this codebase already works around

1. **A `<Text render={…}>` paints nothing if it inherits a `lineHeight` from its
   `<Page>`.** The callback still fires, so it fails silently — the page-number
   footer just disappears. The templates therefore set no `lineHeight` at all
   and rely on the renderer's font-metric leading. See `src/lib/pdf/theme.ts`.
2. **`fixed` repeats an element on *every* page unconditionally**, including
   pages carrying only totals or notes — which printed a table header above no
   rows. Table headers are deliberately not `fixed`.

Fonts are the built-in PDF base-14 (Helvetica) on purpose. Registering a remote
font makes react-pdf fetch it at render time, which is the most common way PDF
routes fail on Vercel.

## Status

Slice 1 is complete: Google sign-in, automatic workspace bootstrap, clients,
invoices with a line-item editor, three PDF templates, and org settings.

Planned next: public client portal links, payment recording, and recurring
invoices.
