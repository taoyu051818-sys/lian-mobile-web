/**
 * Auth-link API client (RFC §2.3 redeem flow).
 *
 * Surfaces two operations for mw#B:
 *   - fetchAuthLinkCard(token) — GET /api/auth-link/:token/card
 *   - redeemAuthLink(token) — POST /api/auth/redeem-link
 *
 * The card endpoint returns a share-card-like preview without exposing grant
 * details. The redeem endpoint atomically applies the token's grant to the
 * current session user.
 */

import { apiGet, apiSend, LianApiError } from "./http";
import { asRecord, asString } from "../platform/api-normalizers";

export interface AuthLinkCard {
  title: string;
  summary: string;
  thumbnailUrl: string;
  url: string;
  kind: string;
  audienceLabel: string;
}

export interface AuthLinkRedemption {
  userId: string;
  redeemedAt: string;
}

export interface AuthLinkRedeemResponse {
  ok: boolean;
  redemption?: AuthLinkRedemption;
}

export type AuthLinkErrorReason = "not-found" | "expired" | "exhausted" | "network";

export class AuthLinkError extends Error {
  reason: AuthLinkErrorReason;
  status: number;

  constructor(reason: AuthLinkErrorReason, status: number, message = "") {
    super(message || reason);
    this.name = "AuthLinkError";
    this.reason = reason;
    this.status = status;
  }
}

interface CardEnvelope {
  ok?: unknown;
  authLink?: unknown;
}

interface RedeemEnvelope {
  ok?: unknown;
  redemption?: unknown;
  error?: unknown;
}

function normalizeCard(raw: unknown): AuthLinkCard {
  const record = asRecord(raw);
  return {
    title: asString(record.title, "黎安邀请你加入"),
    summary: asString(record.audienceLabel),
    thumbnailUrl: asString(record.thumbnailUrl),
    url: asString(record.url),
    kind: asString(record.kind, "auth-link"),
    audienceLabel: asString(record.audienceLabel),
  };
}

function mapErrorReason(status: number, code: string): AuthLinkErrorReason {
  if (status === 404) return "not-found";
  if (status === 410 || code === "expired") return "expired";
  if (status === 409 || code === "exhausted") return "exhausted";
  return "network";
}

/**
 * Fetch the share-card preview for an auth-link token.
 * Does not expose grant details — only title/summary/thumbnail for display.
 */
export async function fetchAuthLinkCard(token: string): Promise<AuthLinkCard> {
  const sanitized = encodeURIComponent(String(token || "").trim());
  if (!sanitized) {
    throw new AuthLinkError("not-found", 400, "token required");
  }

  try {
    const data = await apiGet<CardEnvelope>(`/api/auth-link/${sanitized}/card`);
    return normalizeCard(data?.authLink);
  } catch (error) {
    if (error instanceof LianApiError) {
      const reason = mapErrorReason(error.status, error.code);
      throw new AuthLinkError(reason, error.status, error.message);
    }
    throw new AuthLinkError("network", 0, error instanceof Error ? error.message : "");
  }
}

/**
 * Redeem an auth-link token for the current session user.
 * Atomically applies the token's grant (role / verification) to the user.
 */
export async function redeemAuthLink(token: string): Promise<AuthLinkRedeemResponse> {
  const sanitized = String(token || "").trim();
  if (!sanitized) {
    throw new AuthLinkError("not-found", 400, "token required");
  }

  try {
    const data = await apiSend<RedeemEnvelope>("/api/auth/redeem-link", {
      method: "POST",
      body: JSON.stringify({ token: sanitized }),
    });

    const redemption = asRecord(data?.redemption);
    return {
      ok: Boolean(data?.ok),
      redemption: {
        userId: asString(redemption.userId),
        redeemedAt: asString(redemption.redeemedAt),
      },
    };
  } catch (error) {
    if (error instanceof LianApiError) {
      const reason = mapErrorReason(error.status, error.code);
      throw new AuthLinkError(reason, error.status, error.message);
    }
    throw new AuthLinkError("network", 0, error instanceof Error ? error.message : "");
  }
}
