/**
 * Single place that registers every fixture family.
 *
 * Registration is explicit (no glob/auto-import) so the set of intercepted
 * endpoints is auditable in one file, and so tree-shaking can drop this whole
 * subtree from a production build when the fixture flag is off.
 */

import { registerCommerceFixtures } from "./commerce";
import { registerContentFixtures } from "./content";
import { registerErrandFixtures } from "./errands";
import { registerIdentityFixtures } from "./identity";
import { registerProfileFixtures } from "./profile";

let registered = false;

export function registerAllFixtures(): void {
  // Idempotent: HMR re-runs module init, and double registration would only
  // replace routes, but skipping the work keeps startup logs clean.
  if (registered) return;
  registered = true;

  registerIdentityFixtures();
  registerContentFixtures();
  registerProfileFixtures();
  registerCommerceFixtures();
  registerErrandFixtures();
}

/**
 * Drops the idempotence latch. Needed by tests that call `clearFixtureRoutes()`
 * between cases, which would otherwise leave the latch set and the registry
 * permanently empty.
 */
export function resetFixtureRegistration(): void {
  registered = false;
}
