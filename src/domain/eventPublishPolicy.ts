/**
 * Event publish form validation (PRD V0.1 §6.3 / §11.2).
 *
 * Pure function — given the event-only fields, returns either an empty
 * string (form is valid) or a brand-string error message (first failing
 * field). Lives in `src/domain/` so it stays unit-testable without Vue
 * refs and can be reused from the publish composable, future inline
 * validation, or contract tests.
 *
 * V0.1 scope: validate startsAt < endsAt, capacity >= 0 (or undefined),
 * joinPolicy is a known token. participantScope is reused from the post
 * audience and validated by the audience composable, so it is not
 * re-checked here.
 */

import type { EventJoinPolicy } from "../types/post-extensions";

const KNOWN_JOIN_POLICIES: ReadonlySet<EventJoinPolicy> = new Set([
  "open",
  "approval_required",
  "org_only",
  "school_only",
]);

export interface EventPublishDraft {
  startsAt: string;
  endsAt: string;
  capacity: string;
  joinPolicy: EventJoinPolicy;
}

export interface EventPublishMessages {
  startAfterEnd: string;
  capacityNotInt: string;
  capacityNegative: string;
  joinPolicyUnknown: string;
}

export function isKnownJoinPolicy(value: unknown): value is EventJoinPolicy {
  return typeof value === "string" && KNOWN_JOIN_POLICIES.has(value as EventJoinPolicy);
}

/** Coerce a capacity string to a non-negative integer, or undefined when blank. */
export function parseCapacityInput(
  value: string,
): { ok: true; capacity: number | undefined } | { ok: false; reason: "notInt" | "negative" } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, capacity: undefined };
  const n = Number(trimmed);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return { ok: false, reason: "notInt" };
  if (n < 0) return { ok: false, reason: "negative" };
  return { ok: true, capacity: n };
}

/**
 * Validate the event-only fields. Returns the first failing message, or
 * "" when the draft is acceptable. Caller is expected to short-circuit on
 * the post-level title/body validation first; this only checks the new
 * event fields.
 */
export function validateEventPublishForm(
  draft: EventPublishDraft,
  messages: EventPublishMessages,
): string {
  if (!isKnownJoinPolicy(draft.joinPolicy)) return messages.joinPolicyUnknown;

  const cap = parseCapacityInput(draft.capacity);
  if (!cap.ok) {
    return cap.reason === "negative" ? messages.capacityNegative : messages.capacityNotInt;
  }

  const start = draft.startsAt.trim();
  const end = draft.endsAt.trim();
  if (start && end) {
    const startMs = Date.parse(start);
    const endMs = Date.parse(end);
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && startMs >= endMs) {
      return messages.startAfterEnd;
    }
  }

  return "";
}
