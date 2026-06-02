/**
 * Publish LLM preview client (PRD V0.2 step C/E-pre).
 *
 * Talks to `POST /api/ai/post-preview` and surfaces the additive `candidates`
 * block introduced by ps#534 — separate from `aiPublish.ts` because that
 * legacy client only exposes the original draft fields (title/body/tag/
 * audience/risk) and silently drops the new V0.2 fields. Step E-pre wants
 * a typed handle on `candidates` without disturbing the existing
 * `usePublishAiDraft` glue.
 *
 * Server contract (from `lian-platform-server/src/server/ai-post-preview-candidates.js`):
 *
 *   ResponseEnvelope = {
 *     ok: true,
 *     mode: "mock" | "mimo" | …,
 *     // … pre-existing fields untouched: draft, locationDraft, riskFlags, …
 *     candidates: {
 *       title: string | null,                 // ghost-text title, ≤40 chars
 *       bodyCandidate: string | null,         // 润色 candidate, ≤300 chars
 *       suggestedComponents: Array<{          // typed inline-component hints
 *         type:                                // PRD V0.3 stage B2: V2 kinds
 *           | "location" | "time" | "media" | "quality" | "audience"
 *           | "tags" | "event" | "merchant" | "trade" | "help"
 *           // V1 kinds still tolerated on input for backward compat:
 *           | "event_time" | "price" | "merchant_info"
 *           | "trade_condition" | "help_tag",
 *         reason: string                      // ≤60 chars Chinese
 *       }>,                                   // deduped + capped at 6
 *       inferredKind: "image" | "text" | "event" | "merchant"
 *                   | "trade" | "help" | "place" | null,
 *       modelLatencyMs: number,               // server-measured round-trip
 *       modelName: string                     // for telemetry
 *     }
 *   }
 *
 * Degraded responses (provider unavailable / LLM error) still carry a
 * `candidates` object with all-null/empty fields per ps#534, so callers
 * never branch on `mode` or `degraded` to decide whether candidates exist.
 *
 * Request shape is unchanged from V0.1. See `normalizePostPreviewRequest`
 * in the server schema for the fields it actually reads (`imageUrl`,
 * `imageBase64`, `template`, `userText`, `locationHint`, `visibilityHint`).
 */

import { apiSend, LianApiError } from "./http";
import {
  coerceSuggestedComponentKind,
  isInferredKind,
  type InferredKind,
  type SuggestedComponent,
  type SuggestedComponentKind,
} from "../types/publishSuggestion";

// ---------------------------------------------------------------------------
// Request / response shapes
// ---------------------------------------------------------------------------

export interface PublishLlmTickRequest {
  /** User-typed title; sent as part of `userText` for grounding. */
  title: string;
  /** User-typed body; sent as part of `userText` for grounding. */
  body: string;
  /** Already-uploaded image URLs. Only the first is sent (server only reads `imageUrl`). */
  imageUrls?: ReadonlyArray<string>;
  /** Pre-bound location label, if the user picked one. */
  locationLabel?: string;
}

export interface PublishLlmTickResponse {
  title: string | null;
  bodyCandidate: string | null;
  suggestedComponents: SuggestedComponent[];
  inferredKind: InferredKind | null;
  modelLatencyMs: number;
  modelName: string;
}

const EMPTY_RESPONSE: PublishLlmTickResponse = Object.freeze({
  title: null,
  bodyCandidate: null,
  suggestedComponents: [],
  inferredKind: null,
  modelLatencyMs: 0,
  modelName: "",
}) as PublishLlmTickResponse;

// Server `userText` cap mirrors `truncateText(payload.userText, 300)` in
// `ai-post-preview-schema.js`. We pre-truncate so we don't waste the round
// trip on bytes the server will throw away.
const USER_TEXT_MAX = 300;

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

function asNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function parseSuggestedComponents(value: unknown): SuggestedComponent[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<SuggestedComponentKind>();
  const out: SuggestedComponent[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    // Server emits `type`; we accept `kind` too so an E-main UI mapper
    // round-tripping through this parser doesn't have to rename the field.
    // V1 wire kinds (event_time / price / merchant_info / trade_condition /
    // help_tag) are coerced to V2 here so an older server response still
    // lands as canonical V2 in the rest of the UI.
    const rawKind = record.type ?? record.kind;
    const kind = coerceSuggestedComponentKind(rawKind);
    if (!kind) continue;
    if (seen.has(kind)) continue;
    const labelRaw = record.reason ?? record.label;
    const label = typeof labelRaw === "string" ? labelRaw.trim() : "";
    if (!label) continue;
    seen.add(kind);
    out.push({ kind, payload: {}, label });
  }
  return out;
}

/**
 * Tolerant parser. The UI must keep rendering even if the backend renames a
 * field, drops `candidates` entirely (very old client → very new server, or
 * the reverse), or returns garbage during a degraded fallback path.
 */
export function parseLlmTickResponse(value: unknown): PublishLlmTickResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_RESPONSE, suggestedComponents: [] };
  }
  const record = value as Record<string, unknown>;
  const candidatesRaw = record.candidates;
  if (!candidatesRaw || typeof candidatesRaw !== "object" || Array.isArray(candidatesRaw)) {
    return { ...EMPTY_RESPONSE, suggestedComponents: [] };
  }
  const candidates = candidatesRaw as Record<string, unknown>;
  const inferredRaw = candidates.inferredKind;
  return {
    title: asNullableString(candidates.title),
    bodyCandidate: asNullableString(candidates.bodyCandidate),
    suggestedComponents: parseSuggestedComponents(candidates.suggestedComponents),
    inferredKind: isInferredKind(inferredRaw) ? inferredRaw : null,
    modelLatencyMs: asNumber(candidates.modelLatencyMs),
    modelName: asString(candidates.modelName),
  };
}

// ---------------------------------------------------------------------------
// API call
// ---------------------------------------------------------------------------

function buildUserText(title: string, body: string): string {
  const text = [title, body]
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n");
  if (text.length <= USER_TEXT_MAX) return text;
  return Array.from(text).slice(0, USER_TEXT_MAX).join("");
}

/**
 * Fire one preview round trip. Soft-fails on backend missing / rate limit /
 * 5xx — returns the empty response so the caller's silent-fail philosophy
 * (no toast, no clobber) just falls through. Other errors (auth, network)
 * propagate so the caller can decide; in practice `usePublishLlmTick`
 * swallows them too.
 */
export async function fetchPublishLlmCandidates(
  request: PublishLlmTickRequest,
): Promise<PublishLlmTickResponse> {
  try {
    const data = await apiSend<unknown>("/api/ai/post-preview", {
      method: "POST",
      body: JSON.stringify({
        userText: buildUserText(request.title, request.body),
        imageUrl: request.imageUrls && request.imageUrls.length > 0 ? request.imageUrls[0] : "",
        locationHint: request.locationLabel ?? "",
      }),
    });
    return parseLlmTickResponse(data);
  } catch (error) {
    if (error instanceof LianApiError) {
      if (error.status === 404 || error.status === 429 || error.status >= 500) {
        return { ...EMPTY_RESPONSE, suggestedComponents: [] };
      }
    }
    throw error;
  }
}
