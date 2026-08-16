/**
 * Offline UI Fixture Runtime — shared contract types.
 *
 * This module is DEV-only in effect: every consumer is guarded by
 * `isOfflineFixtureRuntimeEnabled()` which is statically false in production
 * builds, so the whole subtree is tree-shaken out of the shipped bundle.
 *
 * Boundary note: `src/platform/**` must not import from `src/features/**`
 * (enforced by scripts/validate-project-structure.js). Fixture data therefore
 * lives under `./data/**` inside platform rather than being pulled in from
 * feature folders, and handlers are registered into the registry rather than
 * imported by it.
 */

/** Data-shaping scenarios handlers opt into, plus transport-level failures. */
export type FixtureScenario =
  // shaping (handled by each endpoint handler)
  | "normal"
  | "empty"
  | "long-copy"
  | "many-items"
  | "partial-data"
  // transport-level (handled generically, before the handler runs)
  | "loading"
  | "error"
  | "not-found"
  | "unauthorized"
  | "forbidden"
  | "timeout"
  | "rate-limited";

/** Form-surface scenarios. Kept separate so list pages don't offer them. */
export type FixtureFormScenario =
  | "blank"
  | "prefilled"
  | "validation-error"
  | "submitting"
  | "submit-success"
  | "submit-error"
  | "conflict";

export type FixtureIdentity =
  | "guest"
  | "registered"
  | "verified-student"
  | "merchant-pending"
  | "merchant-approved"
  | "runner"
  | "organization-member"
  | "admin"
  | "disabled-user";

export type FixtureVolume = "sparse" | "default" | "dense";

/** Scenarios the transport resolves itself without consulting a handler. */
export const TRANSPORT_SCENARIOS = [
  "loading",
  "error",
  "not-found",
  "unauthorized",
  "forbidden",
  "timeout",
  "rate-limited",
] as const satisfies readonly FixtureScenario[];

export const SHAPING_SCENARIOS = [
  "normal",
  "empty",
  "long-copy",
  "many-items",
  "partial-data",
] as const satisfies readonly FixtureScenario[];

export const FIXTURE_SCENARIOS: readonly FixtureScenario[] = [
  ...SHAPING_SCENARIOS,
  ...TRANSPORT_SCENARIOS,
];

export const FIXTURE_FORM_SCENARIOS: readonly FixtureFormScenario[] = [
  "blank",
  "prefilled",
  "validation-error",
  "submitting",
  "submit-success",
  "submit-error",
  "conflict",
];

export const FIXTURE_IDENTITIES: readonly FixtureIdentity[] = [
  "guest",
  "registered",
  "verified-student",
  "merchant-pending",
  "merchant-approved",
  "runner",
  "organization-member",
  "admin",
  "disabled-user",
];

export const FIXTURE_VOLUMES: readonly FixtureVolume[] = ["sparse", "default", "dense"];

export function isFixtureScenario(value: unknown): value is FixtureScenario {
  return typeof value === "string" && (FIXTURE_SCENARIOS as readonly string[]).includes(value);
}

export function isTransportScenario(value: FixtureScenario): boolean {
  return (TRANSPORT_SCENARIOS as readonly string[]).includes(value);
}

export function isFixtureIdentity(value: unknown): value is FixtureIdentity {
  return typeof value === "string" && (FIXTURE_IDENTITIES as readonly string[]).includes(value);
}

export function isFixtureVolume(value: unknown): value is FixtureVolume {
  return typeof value === "string" && (FIXTURE_VOLUMES as readonly string[]).includes(value);
}

/** Mutable runtime selection driven by the toolbar. */
export interface FixtureRuntimeState {
  scenario: FixtureScenario;
  identity: FixtureIdentity;
  volume: FixtureVolume;
  /** Artificial latency in ms applied to every handled request. */
  latencyMs: number;
  /**
   * When set, overrides `scenario` for transport-level failure injection only,
   * so a data scenario (e.g. many-items) can be combined with a failure.
   */
  errorOverride: FixtureScenario | null;
}

/** Context passed to every endpoint handler. */
export interface FixtureRequestContext {
  method: string;
  /** Normalized pathname, e.g. `/api/posts/12/like`. */
  path: string;
  /** Registered route pattern that matched, e.g. `/api/posts/:id/like`. */
  route: string;
  /** Named params extracted from the route pattern. */
  params: Readonly<Record<string, string>>;
  query: URLSearchParams;
  /** Parsed JSON body when the request carried one, else null. */
  body: unknown;
  state: Readonly<FixtureRuntimeState>;
  /** Effective scenario after applying `errorOverride`. */
  scenario: FixtureScenario;
  identity: FixtureIdentity;
  volume: FixtureVolume;
}

export type FixtureHandlerResult = Response | unknown;

export type FixtureHandler = (
  context: FixtureRequestContext,
) => FixtureHandlerResult | Promise<FixtureHandlerResult>;

export interface FixtureRoute {
  method: string;
  /** Pattern with `:name` segments, matched against the pathname. */
  pattern: string;
  handler: FixtureHandler;
  /** Page family used by the coverage matrix and toolbar grouping. */
  family: string;
}

export type FixtureRequestOutcome = "handled" | "unmapped" | "blocked" | "passthrough";

/** Running tally returned by `getFixtureRequestCounts()` for the DEV toolbar. */
export interface FixtureRequestCounts {
  handled: number;
  unmapped: number;
  blocked: number;
  total: number;
}

export interface FixtureRequestLogEntry {
  id: number;
  at: string;
  method: string;
  path: string;
  route: string;
  scenario: FixtureScenario;
  identity: FixtureIdentity;
  status: number;
  outcome: FixtureRequestOutcome;
}
