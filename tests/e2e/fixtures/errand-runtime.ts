/**
 * Errand-journey fixture helpers (PRD §19.2 P3 + P4 — merchant→errand→runner
 * full chain). The backend (lian-platform-server) seeds a deterministic order
 * at `err_e2e_merchant_runner_001` against verified merchant tid 99 and
 * surfaces it on `GET /api/fixtures` under `fixtures.errandJourney` (non-prod
 * gated, returns 404 in production).
 *
 * Behaviour mirrors `event-runtime.ts`:
 *   - Returns the typed `errandJourney` payload when discovery is available.
 *   - Returns `null` when the surface is gated off, the response is not JSON,
 *     or any network/parse error occurs. Callers decide how to skip — nothing
 *     here should fail-hard since the same suite has to be runnable against
 *     a production-mode backend that 404s on /api/fixtures.
 *
 * The `ensureErrandJourneyOrderForFixture` self-heal on the backend means
 * every successful call to `/api/fixtures` rewrites the order back to
 * `paid_locked` with `runnerUserId === null` UNLESS it is already in that
 * shape. Callers that mutate the order (accept/pickup/deliver) can fetch the
 * fixture again at the end of the suite to verify auto-heal.
 */

import { request } from "@playwright/test";

const DEFAULT_BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

export interface ErrandJourneyLocation {
  placeId: string;
  label: string;
  lat: number | null;
  lng: number | null;
}

export interface ErrandJourneyOrder {
  orderId: string;
  merchantPostId: number;
  status: string;
  state: string;
  title: string;
  creatorUserId: string;
  requesterUserId: string;
  runnerUserId: string | null;
  pickupLocation: ErrandJourneyLocation;
  dropoffLocation: ErrandJourneyLocation;
  mode: string;
  feeAmount: number;
  rewardAmount: number;
  lockedBalanceAmount: number;
}

export interface ErrandJourneyFixture {
  orderId: string;
  ready: boolean;
  reason: string;
  requesterUsername: string;
  requesterUserId: string;
  runnerUsername: string;
  runnerUserId: string;
  merchantPostId: number;
  order: ErrandJourneyOrder | null;
  created: boolean;
  reset: boolean;
}

interface FixturesEnvelope {
  ok?: boolean;
  fixtures?: {
    errandJourney?: Partial<ErrandJourneyFixture> & {
      order?: Partial<ErrandJourneyOrder> | null;
    };
  };
}

function shapeLocation(
  raw: Partial<ErrandJourneyLocation> | null | undefined,
): ErrandJourneyLocation {
  if (!raw || typeof raw !== "object") {
    return { placeId: "", label: "", lat: null, lng: null };
  }
  return {
    placeId: String(raw.placeId ?? ""),
    label: String(raw.label ?? ""),
    lat: typeof raw.lat === "number" && Number.isFinite(raw.lat) ? Number(raw.lat) : null,
    lng: typeof raw.lng === "number" && Number.isFinite(raw.lng) ? Number(raw.lng) : null,
  };
}

function shapeOrder(
  raw: Partial<ErrandJourneyOrder> | null | undefined,
): ErrandJourneyOrder | null {
  if (!raw || typeof raw !== "object") return null;
  if (!raw.orderId) return null;
  return {
    orderId: String(raw.orderId),
    merchantPostId: Number.isFinite(Number(raw.merchantPostId)) ? Number(raw.merchantPostId) : 0,
    status: String(raw.status ?? raw.state ?? ""),
    state: String(raw.state ?? raw.status ?? ""),
    title: String(raw.title ?? ""),
    creatorUserId: String(raw.creatorUserId ?? ""),
    requesterUserId: String(raw.requesterUserId ?? raw.creatorUserId ?? ""),
    runnerUserId: raw.runnerUserId ? String(raw.runnerUserId) : null,
    pickupLocation: shapeLocation(raw.pickupLocation),
    dropoffLocation: shapeLocation(raw.dropoffLocation),
    mode: String(raw.mode ?? ""),
    feeAmount: Number.isFinite(Number(raw.feeAmount)) ? Number(raw.feeAmount) : 0,
    rewardAmount: Number.isFinite(Number(raw.rewardAmount)) ? Number(raw.rewardAmount) : 0,
    lockedBalanceAmount: Number.isFinite(Number(raw.lockedBalanceAmount))
      ? Number(raw.lockedBalanceAmount)
      : 0,
  };
}

/**
 * Fetch the errand-journey fixture from `GET /api/fixtures`. Returns null when
 * the surface is unavailable (404 in production, network failure, malformed
 * payload) so callers can skip without raising.
 *
 * Pass a pre-built `request` context via `options.api` if the caller already
 * has one open; otherwise a short-lived context is created and disposed.
 */
export async function fetchErrandJourneyFixture(
  options: { baseURL?: string; api?: import("@playwright/test").APIRequestContext } = {},
): Promise<ErrandJourneyFixture | null> {
  const baseURL = options.baseURL ?? DEFAULT_BASE_URL;
  const ownsContext = !options.api;
  const api = options.api ?? (await request.newContext({ baseURL }));
  try {
    const response = await api.get("/api/fixtures");
    if (!response.ok()) return null;
    let body: FixturesEnvelope;
    try {
      body = (await response.json()) as FixturesEnvelope;
    } catch {
      return null;
    }
    const journey = body?.fixtures?.errandJourney;
    if (!journey || typeof journey !== "object") return null;
    const orderId = String(journey.orderId ?? "");
    if (!orderId) return null;
    return {
      orderId,
      ready: Boolean(journey.ready),
      reason: String(journey.reason ?? ""),
      requesterUsername: String(journey.requesterUsername ?? ""),
      requesterUserId: String(journey.requesterUserId ?? ""),
      runnerUsername: String(journey.runnerUsername ?? ""),
      runnerUserId: String(journey.runnerUserId ?? ""),
      merchantPostId: Number.isFinite(Number(journey.merchantPostId))
        ? Number(journey.merchantPostId)
        : 0,
      order: shapeOrder(journey.order ?? null),
      created: Boolean(journey.created),
      reset: Boolean(journey.reset),
    };
  } catch {
    return null;
  } finally {
    if (ownsContext) {
      await api.dispose();
    }
  }
}
