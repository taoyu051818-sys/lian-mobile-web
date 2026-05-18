/**
 * Event action policy (PRD V0.1 §6.3 / §11.2).
 *
 * Pure function — given the event extension, the viewer's audience eligibility,
 * and whether the viewer has already joined, decide whether the join button
 * should be enabled, and if not, why.
 *
 * The backend does NOT ship an event status enum on the wire. The frontend
 * derives lifecycle state from `startsAt` / `endsAt` / `capacity` / `joinedCount`:
 *   - `cancelled` / `closed` / `completed` are reserved for future server-driven
 *     terminal states; today the derived status is one of:
 *       - `completed`  — `endsAt` exists and is in the past
 *       - `full`       — `capacity` set and `joinedCount >= capacity`
 *       - `open`       — otherwise (including before `startsAt`)
 *
 * Stays in `src/domain/` so it can be unit-tested without Vue refs.
 */

import type { Audience } from "../types/audience";
import type { EventPostExtension } from "../types/post-extensions";

export type EventStatus = "open" | "full" | "closed" | "completed" | "cancelled";

export type EventActionMode = "join" | "cancel" | "disabled";

export interface EventActionPlan {
  mode: EventActionMode;
  enabled: boolean;
  reasonKey:
    | ""
    | "notOpen"
    | "full"
    | "outOfScope"
    | "alreadyJoined"
    | "notSignedIn"
    | "alreadyEnded";
}

export interface EventActionInput {
  event: EventPostExtension;
  isAuthenticated: boolean;
  hasJoined: boolean;
  isEligibleForScope: (scope: Audience) => boolean;
  /** Override the wall clock for tests; defaults to `Date.now()`. */
  now?: () => number;
}

function parseIsoMs(value: string | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Derive a single status token from the time window + capacity + joinedCount.
 * Pure; no Vue, no clock unless `now` is supplied.
 */
export function derivedEventStatus(
  event: EventPostExtension,
  now: () => number = Date.now,
): EventStatus {
  const endMs = parseIsoMs(event.endsAt);
  if (endMs !== null && endMs <= now()) return "completed";
  if (
    typeof event.capacity === "number" &&
    event.capacity > 0 &&
    event.joinedCount >= event.capacity
  ) {
    return "full";
  }
  return "open";
}

const TERMINAL_STATUSES: ReadonlySet<EventStatus> = new Set(["completed", "cancelled", "closed"]);

export function planEventAction(input: EventActionInput): EventActionPlan {
  const { event, isAuthenticated, hasJoined, isEligibleForScope } = input;
  const status = derivedEventStatus(event, input.now);

  if (TERMINAL_STATUSES.has(status)) {
    return { mode: "disabled", enabled: false, reasonKey: "alreadyEnded" };
  }

  if (hasJoined) {
    return { mode: "cancel", enabled: true, reasonKey: "" };
  }

  if (!isAuthenticated) {
    return { mode: "disabled", enabled: false, reasonKey: "notSignedIn" };
  }

  if (status === "full") {
    return { mode: "disabled", enabled: false, reasonKey: "full" };
  }

  if (status !== "open") {
    return { mode: "disabled", enabled: false, reasonKey: "notOpen" };
  }

  // Audience scope is no longer carried on the read-side event extension
  // (backend audience policy gates `canViewPost` already). The hook is kept
  // for symmetry with feature flags / admin overrides; pass-through default
  // is "true" via the caller.
  const ANY_SCOPE: Audience = {
    visibility: "campus",
    schoolIds: [],
    orgIds: [],
    roleIds: [],
    userIds: [],
    linkOnly: false,
  };
  if (!isEligibleForScope(ANY_SCOPE)) {
    return { mode: "disabled", enabled: false, reasonKey: "outOfScope" };
  }

  return { mode: "join", enabled: true, reasonKey: "" };
}
