/**
 * Audience options API client.
 *
 * Backend route (PRD V0.1 §11.1): GET /api/audience/options
 * The route may be missing in older backends; in that case we return a
 * conservative fallback so publish/feed surfaces keep working with only the
 * "public" option. Never throw to the caller — surfaces should treat
 * audience options as best-effort metadata, not a hard dependency.
 */

import { apiGet, LianApiError } from "./http";
import type { AudienceOption, AudienceVisibility } from "../types/audience";

const FALLBACK_OPTIONS: AudienceOption[] = [
  { visibility: "public", label: "公开", disabled: false },
];

interface AudienceOptionsResponse {
  options?: unknown;
}

const KNOWN_VISIBILITIES: ReadonlySet<AudienceVisibility> = new Set([
  "public",
  "campus",
  "school",
  "private",
  "linkOnly",
]);

function normalizeOption(value: unknown): AudienceOption | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const visibility = record.visibility;
  if (typeof visibility !== "string" || !KNOWN_VISIBILITIES.has(visibility as AudienceVisibility)) {
    return null;
  }
  const label = typeof record.label === "string" && record.label.trim() ? record.label.trim() : visibility;
  const description = typeof record.description === "string" ? record.description : undefined;
  const disabled = Boolean(record.disabled);
  const disabledReason =
    typeof record.disabledReason === "string" && record.disabledReason.trim()
      ? record.disabledReason.trim()
      : undefined;
  return {
    visibility: visibility as AudienceVisibility,
    label,
    description,
    disabled,
    disabledReason,
  };
}

/**
 * Fetch the audience options the current user is allowed to pick.
 * Returns a fallback list (public only) if the backend route is missing or
 * the response is malformed. Network errors propagate as LianApiError so
 * the caller can show a retry affordance if it wants to.
 */
export async function fetchAudienceOptions(): Promise<AudienceOption[]> {
  let response: AudienceOptionsResponse;
  try {
    response = await apiGet<AudienceOptionsResponse>("/api/audience/options");
  } catch (error) {
    // Treat 404 as "feature not deployed yet" and fall back silently.
    if (error instanceof LianApiError && error.status === 404) {
      return [...FALLBACK_OPTIONS];
    }
    throw error;
  }
  if (!response || !Array.isArray(response.options)) {
    return [...FALLBACK_OPTIONS];
  }
  const out: AudienceOption[] = [];
  for (const raw of response.options) {
    const option = normalizeOption(raw);
    if (option) out.push(option);
  }
  return out.length ? out : [...FALLBACK_OPTIONS];
}
