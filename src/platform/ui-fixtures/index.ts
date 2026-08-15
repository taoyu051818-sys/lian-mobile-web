/**
 * Public entry point for the offline UI fixture runtime.
 *
 * This is the ONLY module the application imports, and it is the guard
 * boundary. Everything heavy — handlers, corpus, the Vue toolbar — is behind a
 * dynamic `import()` that runs only when the guard passes, so a production
 * build never pulls fixture code into the graph.
 *
 * Guard = `import.meta.env.DEV && VITE_UI_FIXTURES === "true"`.
 * `import.meta.env.DEV` is statically `false` in `vite build`, which lets
 * Rollup drop the entire branch (verified by a build-output assertion test).
 */

import { isOfflineFixtureRuntimeEnabled } from "./env";

let started = false;

/**
 * Installs the offline fixture transport and mounts the DEV toolbar.
 *
 * Returns `true` when the runtime actually started. Safe to call
 * unconditionally: it no-ops in production and when the flag is off.
 */
export async function startOfflineFixtureRuntime(): Promise<boolean> {
  if (!isOfflineFixtureRuntimeEnabled()) return false;
  // Vite HMR can re-run the entry module; installing twice would double-wrap
  // `fetch` and log every request twice.
  if (started) return true;
  started = true;

  const [{ registerAllFixtures }, { hydrateFixtureState }, { installOfflineFixtureTransport }] =
    await Promise.all([import("./data"), import("./state"), import("./transport")]);

  hydrateFixtureState();
  registerAllFixtures();
  installOfflineFixtureTransport();

  const { mountFixtureToolbar } = await import("./dev/mount");
  mountFixtureToolbar();

  return true;
}
