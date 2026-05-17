/**
 * Like/vote unified interaction API (PRD V0.1 §7.1.2, §11.3).
 *
 * Backend already exposes `/api/posts/:tid/like` for likes; the PRD adds
 * `/api/posts/:tid/vote` for the help-card "vote" semantic. Both share the
 * same toggle-and-return-state contract — only the wording changes.
 *
 * Errors propagate as `LianApiError` so callers can distinguish auth-required
 * (401), already-toggled (409), and rate-limit (429) cases.
 */

import { apiSend } from "./http";
import type { InteractionKind, InteractionToggleResult } from "../types/post-extensions";

interface RawToggleResponse {
  tid?: number | string;
  count?: number | string;
  liked?: boolean;
  voted?: boolean;
  active?: boolean;
}

function parseTid(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function parseCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.max(0, n);
  }
  return 0;
}

function endpointFor(tid: number, kind: InteractionKind): string {
  return kind === "vote" ? `/api/posts/${tid}/vote` : `/api/posts/${tid}/like`;
}

/**
 * Toggle a like or vote on a post. Returns the new active state and the
 * authoritative count. Caller is responsible for showing auth gates when the
 * server returns 401.
 */
export async function togglePostInteraction(
  tid: number,
  kind: InteractionKind,
): Promise<InteractionToggleResult> {
  const raw = await apiSend<RawToggleResponse>(endpointFor(tid, kind), {
    method: "POST",
  });
  const active = Boolean(raw?.active ?? raw?.liked ?? raw?.voted);
  return {
    tid: parseTid(raw?.tid, tid),
    kind,
    active,
    count: parseCount(raw?.count),
  };
}
