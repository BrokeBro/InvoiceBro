/**
 * Neutralise the `server-only` package for standalone scripts.
 *
 * `server-only` throws on import outside Next's bundler, which is exactly what
 * it's for — it stops server modules leaking into client bundles. Scripts like
 * the smoke test genuinely do run on a server, and stubbing it here lets them
 * exercise the real application modules rather than a divergent copy.
 *
 * Import this FIRST, before anything that reaches src/lib — imports are hoisted,
 * so the patch has to live in its own module to run before them.
 */

import Module from "node:module";

type Loader = (this: unknown, request: string, ...rest: unknown[]) => unknown;

const moduleInternals = Module as unknown as { _load: Loader };
const originalLoad = moduleInternals._load;

moduleInternals._load = function (this: unknown, request: string, ...rest: unknown[]) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...rest);
};
