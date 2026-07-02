/**
 * Help-runtime fixture helper (issue #771, depends on
 * lian-platform-server #472).
 *
 * The backend seeds a deterministic open help post at tid 200 and surfaces
 * the runtime metadata via `GET /api/fixtures` (non-prod gated, returns 404
 * in production). This module wraps that discovery surface so the help-manage
 * Playwright lane can avoid hardcoding the tid or the seeded author id:
 *
 *   const fixture = await fetchHelpRuntimeFixture();
 *   if (!fixture?.ready) test.skip(true, "help-runtime fixture not ready");
 *
 * Behaviour mirrors `fetchEventRuntimeFixture`:
 *   - Returns the typed `helpRuntime` payload when discovery is available.
 *   - Returns `null` if discovery is gated off (404), the response is not
 *     JSON-shaped, or any network/parse error occurs. Callers decide how to
 *     skip; nothing here should fail-hard, since the same suite has to be
 *     runnable against a production-mode backend that 404s on /api/fixtures.
 *
 * Self-heal contract (backend #472): when the live store has drifted (e.g. a
 * previous run resolved the help post), the next discovery call patches the
 * canonical mirror back from `data/fixtures/post-metadata.e2e.json`, so the
 * help-manage spec sees a fresh `status: "open"` / `linkedEventId: null`
 * fixture each run.
 */

import { request } from "@playwright/test";

import { retryTransientApiRequest } from "./retry";

const DEFAULT_BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

export type HelpRuntimeStatus = "open" | "linked_event" | "resolved" | "closed";

export interface HelpRuntimeHelp {
  helpId: string;
  status: HelpRuntimeStatus;
  voteCount: number;
  linkedEventId: string | null;
  authorUserId: string;
  presentationIntent: string;
  contentType: string;
}

export interface HelpRuntimeFixture {
  tid: number;
  ready: boolean;
  help: HelpRuntimeHelp | null;
  title: string;
  expectedAuthorUserId: string;
}

interface FixturesEnvelope {
  ok?: boolean;
  fixtures?: {
    helpRuntime?: Partial<HelpRuntimeFixture> & {
      help?: Partial<HelpRuntimeHelp> | null;
    };
  };
}

const KNOWN_STATUSES: ReadonlySet<HelpRuntimeStatus> = new Set([
  "open",
  "linked_event",
  "resolved",
  "closed",
]);

function shapeStatus(raw: unknown): HelpRuntimeStatus {
  const value = String(raw ?? "");
  return (KNOWN_STATUSES.has(value as HelpRuntimeStatus) ? value : "open") as HelpRuntimeStatus;
}

function shapeHelp(raw: Partial<HelpRuntimeHelp> | null | undefined): HelpRuntimeHelp | null {
  if (!raw || typeof raw !== "object") return null;
  const linkedRaw = raw.linkedEventId;
  const linkedEventId =
    typeof linkedRaw === "string" && linkedRaw.length > 0
      ? linkedRaw
      : typeof linkedRaw === "number" && Number.isFinite(linkedRaw)
        ? String(linkedRaw)
        : null;
  return {
    helpId: String(raw.helpId ?? ""),
    status: shapeStatus(raw.status),
    voteCount: Number.isFinite(raw.voteCount) ? Number(raw.voteCount) : 0,
    linkedEventId,
    authorUserId: String(raw.authorUserId ?? ""),
    presentationIntent: String(raw.presentationIntent ?? ""),
    contentType: String(raw.contentType ?? ""),
  };
}

/**
 * Fetch the help-runtime fixture from `GET /api/fixtures`. Returns null when
 * the surface is unavailable (404 in production, network failure, malformed
 * payload) so callers can skip without raising.
 *
 * Pass a pre-built `request` context via `options.api` if the caller already
 * has one open; otherwise a short-lived context is created and disposed.
 */
export async function fetchHelpRuntimeFixture(
  options: { baseURL?: string; api?: import("@playwright/test").APIRequestContext } = {},
): Promise<HelpRuntimeFixture | null> {
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
    const runtime = body?.fixtures?.helpRuntime;
    if (!runtime || typeof runtime !== "object") return null;
    const tid =
      typeof runtime.tid === "number" && Number.isFinite(runtime.tid) ? runtime.tid : Number.NaN;
    if (!Number.isFinite(tid)) return null;
    return {
      tid,
      ready: Boolean(runtime.ready),
      help: shapeHelp(runtime.help ?? null),
      title: String(runtime.title ?? ""),
      expectedAuthorUserId: String(runtime.expectedAuthorUserId ?? ""),
    };
  } catch {
    return null;
  } finally {
    if (ownsContext) {
      await api.dispose();
    }
  }
}
