/**
 * Audience model — frontend mirror of the backend AUDIENCE_SYSTEM contract.
 *
 * Three permission axes are kept separate (PRD V0.1 §3.1):
 *   - viewPermission     who can see the post (Audience below)
 *   - actionPermission   who can like / vote / comment / join / trade
 *   - publishPermission  who can author this post type
 *
 * This module only owns the view-side `Audience` type plus a normalizer.
 * Action and publish permissions live with their respective features so
 * they can grow independently without coupling all three.
 */

export type AudienceVisibility =
  | "public"
  | "campus"
  | "school"
  | "private"
  | "linkOnly";

export interface Audience {
  visibility: AudienceVisibility;
  schoolIds: string[];
  orgIds: string[];
  roleIds: string[];
  userIds: string[];
  linkOnly: boolean;
}

/**
 * Per-option metadata returned by GET /api/audience/options.
 * `disabled` + `disabledReason` let the UI gray out options the current
 * user is not allowed to pick (and surface why) without hardcoding policy.
 */
export interface AudienceOption {
  visibility: AudienceVisibility;
  label: string;
  description?: string;
  disabled: boolean;
  disabledReason?: string;
}

export const DEFAULT_AUDIENCE: Audience = Object.freeze({
  visibility: "public",
  schoolIds: [],
  orgIds: [],
  roleIds: [],
  userIds: [],
  linkOnly: false,
}) as Audience;

const KNOWN_VISIBILITIES: ReadonlySet<AudienceVisibility> = new Set([
  "public",
  "campus",
  "school",
  "private",
  "linkOnly",
]);

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry === "string") {
      const trimmed = entry.trim();
      if (trimmed) out.push(trimmed);
    } else if (typeof entry === "number" && Number.isFinite(entry)) {
      out.push(String(entry));
    }
  }
  return out;
}

function normalizeVisibility(value: unknown): AudienceVisibility {
  return typeof value === "string" && KNOWN_VISIBILITIES.has(value as AudienceVisibility)
    ? (value as AudienceVisibility)
    : "public";
}

/**
 * Coerce an unknown payload (e.g. a backend response or a legacy publish
 * draft) into a well-typed Audience. Missing/invalid fields fall back to
 * the public default — never throws.
 */
export function normalizeAudience(value: unknown): Audience {
  if (!value || typeof value !== "object") return { ...DEFAULT_AUDIENCE };
  const record = value as Record<string, unknown>;
  return {
    visibility: normalizeVisibility(record.visibility),
    schoolIds: normalizeStringArray(record.schoolIds),
    orgIds: normalizeStringArray(record.orgIds),
    roleIds: normalizeStringArray(record.roleIds),
    userIds: normalizeStringArray(record.userIds),
    linkOnly: Boolean(record.linkOnly),
  };
}

/**
 * True iff `audience` is the unmodified public default. Useful for skipping
 * the audience field on the wire when the user has not narrowed visibility.
 */
export function isDefaultAudience(audience: Audience): boolean {
  return (
    audience.visibility === "public" &&
    !audience.linkOnly &&
    audience.schoolIds.length === 0 &&
    audience.orgIds.length === 0 &&
    audience.roleIds.length === 0 &&
    audience.userIds.length === 0
  );
}
