/**
 * AI publish API client (PRD V0.1 §3 / §7.4 / Phase 3).
 *
 * Three endpoints, all already in the backend live surface:
 *   POST /api/ai/post-preview   — ask the model to draft suggestions from
 *                                 a partial form (image-only is allowed).
 *   POST /api/ai/post-drafts    — persist a draft for later finalization.
 *   POST /api/ai/post-publish   — final publish call (already used today).
 *
 * V0.1 only consumes the *preview* response shape on the frontend. Drafts
 * are persisted opportunistically; the response shape is `{ draftId }`.
 *
 * The AI route is "best effort" — when the backend returns 404 / 429 / 5xx
 * the publish UI keeps working with the user's manual input. We never block
 * the user on AI.
 */

import { apiSend, LianApiError } from "./http";
import type { Audience } from "../types/audience";
import { normalizeAudience } from "../types/audience";

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export interface AiPreviewRequest {
  imageUrls: string[];
  /** Free-form user note. Empty allowed (image-only flow). */
  hint?: string;
  /** Pre-bound location, if the user already picked one. */
  locationLabel?: string;
}

export interface AiPreviewSuggestions {
  title: string;
  body: string;
  /** Single primary tag (with leading `#` already normalized). */
  tag: string;
  /** Audience the model thinks fits. UI may override. */
  audience: Audience | null;
  /** Free-form risk warnings the user should see before publishing. */
  riskFlags: string[];
  /** Confidence 0–1 from the backend; 0 when missing. */
  confidence: number;
  /** True when the backend wants a human to vet the post before publish. */
  needsHumanReview: boolean;
}

export interface AiDraftRequest extends AiPreviewSuggestions {
  imageUrls: string[];
  locationLabel?: string;
}

export interface AiDraftResponse {
  draftId: string;
}

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry === "string") {
      const trimmed = entry.trim();
      if (trimmed) out.push(trimmed);
    }
  }
  return out;
}

function asConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/**
 * Coerce an arbitrary backend response into the typed `AiPreviewSuggestions`
 * shape. Tolerant by design — the UI must keep rendering even if a key is
 * missing, malformed, or renamed by the backend mid-flight.
 */
export function parseAiPreviewSuggestions(value: unknown): AiPreviewSuggestions {
  const record =
    (value && typeof value === "object" ? (value as Record<string, unknown>) : {}) || {};
  // Backend may use either `audience` or `suggestedAudience`.
  const rawAudience = record.audience ?? record.suggestedAudience;
  return {
    title: asString(record.title ?? record.suggestedTitle),
    body: asString(record.body ?? record.suggestedBody),
    tag: asString(record.tag ?? record.primaryTag ?? record.suggestedTag),
    audience: rawAudience ? normalizeAudience(rawAudience) : null,
    riskFlags: asStringArray(record.riskFlags ?? record.warnings),
    confidence: asConfidence(record.confidence),
    needsHumanReview: Boolean(record.needsHumanReview),
  };
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

const EMPTY_SUGGESTIONS: AiPreviewSuggestions = Object.freeze({
  title: "",
  body: "",
  tag: "",
  audience: null,
  riskFlags: [],
  confidence: 0,
  needsHumanReview: false,
}) as AiPreviewSuggestions;

/**
 * Ask the backend for AI suggestions. On 404/429/5xx returns an empty
 * suggestion bundle — the UI shows the user's manual input unchanged.
 * Network errors propagate so the caller can show a retry chip if needed.
 */
export async function fetchAiPostPreview(request: AiPreviewRequest): Promise<AiPreviewSuggestions> {
  try {
    const data = await apiSend<unknown>("/api/ai/post-preview", {
      method: "POST",
      body: JSON.stringify({
        imageUrls: request.imageUrls,
        hint: request.hint ?? "",
        locationLabel: request.locationLabel ?? "",
      }),
    });
    return parseAiPreviewSuggestions(data);
  } catch (error) {
    if (error instanceof LianApiError) {
      // Treat "not deployed" / "rate limited" / "AI down" as a soft failure.
      if (error.status === 404 || error.status === 429 || error.status >= 500) {
        return { ...EMPTY_SUGGESTIONS };
      }
    }
    throw error;
  }
}

/**
 * Persist a draft so the user's progress is recoverable cross-session.
 * Returns null when the route is missing — the UI falls back to local
 * `usePublishDraftSession` storage.
 */
export async function saveAiPostDraft(input: AiDraftRequest): Promise<AiDraftResponse | null> {
  try {
    const data = await apiSend<{ draftId?: unknown }>("/api/ai/post-drafts", {
      method: "POST",
      body: JSON.stringify(input),
    });
    const draftId = asString(data?.draftId);
    return draftId ? { draftId } : null;
  } catch (error) {
    if (error instanceof LianApiError && (error.status === 404 || error.status >= 500)) {
      return null;
    }
    throw error;
  }
}
