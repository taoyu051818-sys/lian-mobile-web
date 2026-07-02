/**
 * Event-runtime fixture helpers (issue #707, depends on
 * lian-platform-server #437 / PR #443).
 *
 * The backend seeds a deterministic rewarded event at tid 156 and surfaces
 * the runtime metadata via `GET /api/fixtures` (non-prod gated, returns 404
 * in production). This module wraps that discovery surface so journey specs
 * can avoid hardcoding the tid or the seeded user ids:
 *
 *   const fixture = await fetchEventRuntimeFixture();
 *   if (!fixture?.ready) test.skip(true, "event-runtime fixture not ready");
 *
 * Behaviour:
 *   - Returns the typed `eventRuntime` payload when discovery is available.
 *   - Returns `null` if discovery is gated off (404), the response is not
 *     JSON-shaped, or any network/parse error occurs. Callers decide how to
 *     skip; nothing here should fail-hard, since the same suite has to be
 *     runnable against a production-mode backend that 404s on /api/fixtures.
 *
 * `getSeededEventId()` is a tiny env-var reader that defaults to "156" so
 * dev-mode `npm run test:e2e` does not crash when the var is unset. The
 * Playwright harness still expects callers to skip when the runtime fixture
 * is not actually `ready`.
 */

import { request } from "@playwright/test";

import { retryTransientApiRequest } from "./retry";

const DEFAULT_BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

/** Default tid used when LIAN_E2E_SEEDED_EVENT_ID is unset. Must match the
 *  backend seed in scripts/seed-e2e-account.js / fixture-discovery-service.js
 *  (issue #439). Kept here only to avoid undefined env crashes; specs should
 *  prefer `fetchEventRuntimeFixture().tid` over this default. */
const DEFAULT_SEEDED_EVENT_ID = "156";

export interface EventRuntimeEvent {
  eventId: string;
  status: string;
  authorUserId: string;
  rewardCurrency: string;
  rewardBudget: number;
  rewardPerJoiner: number;
  joinedUserIds: readonly string[];
  joinedCount: number;
  startsAt: string;
  endsAt: string;
}

export interface EventRuntimeFixture {
  tid: number;
  ready: boolean;
  event: EventRuntimeEvent | null;
  title: string;
  expectedAuthorUserId: string;
  expectedJoinerUserId: string;
}

interface FixturesEnvelope {
  ok?: boolean;
  fixtures?: {
    eventRuntime?: Partial<EventRuntimeFixture> & {
      event?: Partial<EventRuntimeEvent> | null;
    };
  };
}

/**
 * Read the seeded event tid from `LIAN_E2E_SEEDED_EVENT_ID`, falling back to
 * the well-known default ("156") so dev-mode runs do not crash on missing env.
 * Specs that need to assert the runtime fixture is actually wired should
 * prefer `fetchEventRuntimeFixture()` and check `ready === true`.
 */
export function getSeededEventId(): string {
  const raw = process.env.LIAN_E2E_SEEDED_EVENT_ID;
  if (typeof raw !== "string") return DEFAULT_SEEDED_EVENT_ID;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_SEEDED_EVENT_ID;
}

/**
 * `true` iff `LIAN_E2E_SEEDED_EVENT_ID` is explicitly set. Specs use this to
 * decide between running and skipping with a clear reason.
 */
export function isSeededEventIdConfigured(): boolean {
  const raw = process.env.LIAN_E2E_SEEDED_EVENT_ID;
  return typeof raw === "string" && raw.trim().length > 0;
}

function shapeEvent(raw: Partial<EventRuntimeEvent> | null | undefined): EventRuntimeEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const joinedUserIds = Array.isArray(raw.joinedUserIds)
    ? raw.joinedUserIds.map((id) => String(id ?? "")).filter((id) => id.length > 0)
    : [];
  return {
    eventId: String(raw.eventId ?? ""),
    status: String(raw.status ?? ""),
    authorUserId: String(raw.authorUserId ?? ""),
    rewardCurrency: String(raw.rewardCurrency ?? ""),
    rewardBudget: Number.isFinite(raw.rewardBudget) ? Number(raw.rewardBudget) : 0,
    rewardPerJoiner: Number.isFinite(raw.rewardPerJoiner) ? Number(raw.rewardPerJoiner) : 0,
    joinedUserIds,
    joinedCount:
      typeof raw.joinedCount === "number" && Number.isFinite(raw.joinedCount)
        ? raw.joinedCount
        : joinedUserIds.length,
    startsAt: String(raw.startsAt ?? ""),
    endsAt: String(raw.endsAt ?? ""),
  };
}

/**
 * Fetch the event-runtime fixture from `GET /api/fixtures`. Returns null when
 * the surface is unavailable (404 in production, network failure, malformed
 * payload) so callers can skip without raising.
 *
 * Pass a pre-built `request` context via `options.api` if the caller already
 * has one open; otherwise a short-lived context is created and disposed.
 */
export async function fetchEventRuntimeFixture(
  options: { baseURL?: string; api?: import("@playwright/test").APIRequestContext } = {},
): Promise<EventRuntimeFixture | null> {
  const baseURL = options.baseURL ?? DEFAULT_BASE_URL;
  const ownsContext = !options.api;
  const api = options.api ?? (await request.newContext({ baseURL }));
  try {
    const response = await retryTransientApiRequest(() => api.get("/api/fixtures"));
    if (!response.ok()) return null;
    let body: FixturesEnvelope;
    try {
      body = (await response.json()) as FixturesEnvelope;
    } catch {
      return null;
    }
    const runtime = body?.fixtures?.eventRuntime;
    if (!runtime || typeof runtime !== "object") return null;
    const tid =
      typeof runtime.tid === "number" && Number.isFinite(runtime.tid) ? runtime.tid : Number.NaN;
    if (!Number.isFinite(tid)) return null;
    return {
      tid,
      ready: Boolean(runtime.ready),
      event: shapeEvent(runtime.event ?? null),
      title: String(runtime.title ?? ""),
      expectedAuthorUserId: String(runtime.expectedAuthorUserId ?? ""),
      expectedJoinerUserId: String(runtime.expectedJoinerUserId ?? ""),
    };
  } catch {
    return null;
  } finally {
    if (ownsContext) {
      await api.dispose();
    }
  }
}
