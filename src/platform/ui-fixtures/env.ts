/**
 * Offline fixture runtime switch.
 *
 * `import.meta.env.DEV` is statically replaced with `false` by Vite in
 * production builds, so every `if (isOfflineFixtureRuntimeEnabled())` branch
 * collapses to dead code and the fixture registry, data and toolbar are all
 * dropped from the shipped bundle. Keep the `DEV` check first and literal —
 * do not hoist it behind another indirection or the constant folding breaks.
 */

import type { FixtureScenario, FixtureIdentity } from "./types";
import { isFixtureScenario, isFixtureIdentity } from "./types";

export const OFFLINE_FIXTURE_MODE = "offline";

/**
 * True only when all three conditions hold:
 *   1. dev build,
 *   2. `VITE_UI_FIXTURES === "true"`,
 *   3. `VITE_UI_FIXTURE_MODE === "offline"`.
 */
export function isOfflineFixtureRuntimeEnabled(): boolean {
  return (
    import.meta.env.DEV &&
    import.meta.env.VITE_UI_FIXTURES === "true" &&
    import.meta.env.VITE_UI_FIXTURE_MODE === OFFLINE_FIXTURE_MODE
  );
}

/**
 * Render-level fixture switch (the pre-existing `VITE_UI_FIXTURES` behaviour
 * from PR #1094, which overrides component input without touching the
 * network). Kept separate so the offline transport and the render override are
 * independently controllable.
 */
export function isRenderFixtureEnabled(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_UI_FIXTURES === "true";
}

/** Env-provided first-run default only; the toolbar owns it afterwards. */
export function readDefaultScenario(): FixtureScenario {
  const raw = import.meta.env.VITE_UI_FIXTURE_SCENARIO;
  return isFixtureScenario(raw) ? raw : "normal";
}

/** Env-provided first-run default only; the toolbar owns it afterwards. */
export function readDefaultIdentity(): FixtureIdentity {
  const raw = import.meta.env.VITE_UI_FIXTURE_IDENTITY;
  return isFixtureIdentity(raw) ? raw : "verified-student";
}
