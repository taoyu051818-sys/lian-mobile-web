/**
 * Suggested-component types for the publish LLM tick.
 *
 * PRD V0.3 stage B2 (paired with ps#624): the AI preview now emits canonical
 * V2 component kinds — `location | time | media | quality | audience | tags |
 * event | merchant | trade | help`. The wire still tolerates the legacy V1
 * type strings (`event_time / price / merchant_info / trade_condition /
 * help_tag`) so an older client/server combo doesn't black-hole the ghost
 * list; `parseSuggestedComponents` in `aiPreview.ts` is the single point of
 * V1→V2 mapping.
 *
 * Frontend canonical shape stays `{ kind, payload, label }`:
 *
 *   - `kind`     — V2 enum. `kind` not `type` so it doesn't shadow the JS
 *                  `type` keyword.
 *   - `label`    — human-readable string the ghost component renders. Sourced
 *                  from backend `reason` for now; brand constants may
 *                  override per-kind in a future pass.
 *   - `payload`  — bag of kind-specific defaults that `accept()` 实化 code
 *                  hands to the corresponding sub-draft. Empty today.
 */

export type SuggestedComponentKind =
  | "location"
  | "time"
  | "media"
  | "quality"
  | "audience"
  | "tags"
  | "event"
  | "merchant"
  | "trade"
  | "help";

/** V1 wire-only kinds we still tolerate on input. Mapped to V2 by the parser. */
export type LegacySuggestedComponentKind =
  | "event_time"
  | "price"
  | "merchant_info"
  | "trade_condition"
  | "help_tag";

export interface SuggestedComponent {
  kind: SuggestedComponentKind;
  payload: Record<string, unknown>;
  label: string;
}

export const SUGGESTED_COMPONENT_KINDS: ReadonlyArray<SuggestedComponentKind> = [
  "location",
  "time",
  "media",
  "quality",
  "audience",
  "tags",
  "event",
  "merchant",
  "trade",
  "help",
];

/**
 * V1 → V2 wire mapping. Mirrors `V1_TO_V2_COMPONENT_TYPE` in
 * `lian-platform-server/src/server/post-metadata-components.js` — the parser
 * uses it to keep an older server's response from being dropped on the floor.
 * `location` is a passthrough (same name in both versions).
 */
const LEGACY_TO_V2_KIND: Readonly<Record<LegacySuggestedComponentKind, SuggestedComponentKind>> = {
  event_time: "time",
  price: "trade",
  merchant_info: "merchant",
  trade_condition: "trade",
  help_tag: "help",
};

const V2_KIND_SET: ReadonlySet<SuggestedComponentKind> = new Set(SUGGESTED_COMPONENT_KINDS);

const LEGACY_KIND_SET: ReadonlySet<LegacySuggestedComponentKind> = new Set(
  Object.keys(LEGACY_TO_V2_KIND) as LegacySuggestedComponentKind[],
);

export type InferredKind = "image" | "text" | "event" | "merchant" | "trade" | "help" | "place";

const INFERRED_KIND_VALUES: ReadonlySet<InferredKind> = new Set([
  "image",
  "text",
  "event",
  "merchant",
  "trade",
  "help",
  "place",
]);

export function isSuggestedComponentKind(value: unknown): value is SuggestedComponentKind {
  return typeof value === "string" && V2_KIND_SET.has(value as SuggestedComponentKind);
}

/**
 * Coerce a wire-`type` string (V1 or V2) to the canonical V2 kind, or null
 * when the value is neither. Pure mapper — no allocation, no logging.
 */
export function coerceSuggestedComponentKind(value: unknown): SuggestedComponentKind | null {
  if (typeof value !== "string") return null;
  if (V2_KIND_SET.has(value as SuggestedComponentKind)) return value as SuggestedComponentKind;
  if (LEGACY_KIND_SET.has(value as LegacySuggestedComponentKind)) {
    return LEGACY_TO_V2_KIND[value as LegacySuggestedComponentKind];
  }
  return null;
}

export function isInferredKind(value: unknown): value is InferredKind {
  return typeof value === "string" && INFERRED_KIND_VALUES.has(value as InferredKind);
}
