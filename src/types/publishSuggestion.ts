/**
 * Suggested-component types for the publish LLM tick (PRD V0.2 step E).
 *
 * The backend (`ai-post-preview-candidates.js`) emits one of six typed
 * inline-component hints per LLM response:
 *
 *   - location          — "加个地点"
 *   - event_time        — "这是活动吗？加个时间"
 *   - price             — "加个价格"
 *   - merchant_info     — "看起来像商家信息"
 *   - trade_condition   — "加个二手物品状态"
 *   - help_tag          — "需要别人帮忙吗？"
 *
 * The frontend stores them as `{ kind, payload, label }` rather than the
 * server's `{ type, reason }`:
 *
 *   - `kind`     — same enum as backend `type`, renamed so the frontend
 *                  doesn't shadow the JS `type` keyword and so future
 *                  E-main UI code reads naturally (`if (s.kind === ...)`).
 *   - `label`    — human-readable string the ghost component renders.
 *                  Sourced from backend `reason` for now; E-main may
 *                  override per-kind from a brand constant.
 *   - `payload`  — bag of kind-specific defaults that E-main "实化" code
 *                  hands to the corresponding sub-draft (event/merchant/
 *                  trade/place). Empty here in step E-pre — only the
 *                  pipe is built; E-main will populate.
 *
 * Step E-pre scope: types + state plumbing only. No UI consumes
 * `suggestedComponents` yet; that lands in E-main.
 */

export type SuggestedComponentKind =
  | "location"
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
  "event_time",
  "price",
  "merchant_info",
  "trade_condition",
  "help_tag",
];

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
  return (
    typeof value === "string" &&
    (SUGGESTED_COMPONENT_KINDS as ReadonlyArray<string>).includes(value)
  );
}

export function isInferredKind(value: unknown): value is InferredKind {
  return typeof value === "string" && INFERRED_KIND_VALUES.has(value as InferredKind);
}
