/**
 * Development-only preview switch for the commerce catalog UI.
 *
 * Contract:
 *   - the returned ref stays `null` unless BOTH `import.meta.env.DEV` and
 *     `VITE_UI_FIXTURES === "true"` hold. Because the fixture module is reached
 *     through a dynamic `import()` inside that guard, a production build folds
 *     the guard to `false`, never references the chunk, and ships none of the
 *     fixture strings;
 *   - an unknown or missing scenario name also stays `null`, so a typo can
 *     never silently replace real data with a fixture;
 *   - it only overrides what the catalog *renders*. The read owner
 *     (`useCommerceStoreRead`) still runs, still issues the same
 *     `/api/commerce/stores` request, and still owns retry — this switch never
 *     fakes a request, a response, or a network state.
 */

import { shallowRef, type Ref } from "vue";
import type {
  CommerceStoreUiFixture,
  CommerceStoreUiFixtureName,
} from "../__fixtures__/commerce-store-fixtures";

const KNOWN_SCENARIOS: readonly CommerceStoreUiFixtureName[] = [
  "normal",
  "long-copy",
  "many-items",
  "zero-rating",
  "missing-summary",
  "loading",
  "empty",
  "error",
  "timeout",
  "rate-limited",
];

function requestedScenario(): CommerceStoreUiFixtureName | null {
  const scenario = import.meta.env.VITE_UI_FIXTURE_SCENARIO;
  if (!scenario) return null;
  return KNOWN_SCENARIOS.find((name) => name === scenario) ?? null;
}

export function useCommerceStoreUiFixture(): Ref<CommerceStoreUiFixture | null> {
  const fixture = shallowRef<CommerceStoreUiFixture | null>(null);
  if (!import.meta.env.DEV || import.meta.env.VITE_UI_FIXTURES !== "true") return fixture;

  const scenario = requestedScenario();
  if (!scenario) return fixture;

  void import("../__fixtures__/commerce-store-fixtures").then((module) => {
    fixture.value = module.buildCommerceStoreUiFixtures()[scenario];
  });

  return fixture;
}
