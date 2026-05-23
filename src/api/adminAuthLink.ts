/**
 * Admin auth-link API client (RFC: AUTH_LINK_RFC_2026_05_23.md).
 *
 * Backend routes (ps#B):
 *   - POST /api/admin/auth-link — create link with optional grant
 *   - GET /api/admin/auth-links — list all links
 *   - DELETE /api/admin/auth-link/:token — revoke link
 */

import { apiGet, apiSend } from "./http";
import { asNumber, asRecord, asString } from "../platform/api-normalizers";

export type AuthLinkGrantKind =
  | "campus_verified"
  | "org_member"
  | "realname_verified"
  | "merchant_verified"
  | "runner";

export interface AuthLinkGrant {
  roleId?: string;
  verificationKind?: AuthLinkGrantKind;
  verificationPayload?: Record<string, unknown>;
}

export interface AuthLink {
  token: string;
  createdByUserId: string;
  createdAt: string;
  expiresAt: string;
  maxUses: number;
  usedCount: number;
  audienceLabel: string;
  grant: AuthLinkGrant;
}

export interface AuthLinkCreatePayload {
  grant?: AuthLinkGrant;
  maxUses?: number;
  ttlSeconds?: number;
  audienceLabel?: string;
}

export interface AuthLinkListResponse {
  items: AuthLink[];
  total: number;
}

function withAuthHeader(token: string, init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers || {});
  if (token) headers.set("authorization", `Bearer ${token}`);
  return { ...init, headers };
}

function normalizeGrant(raw: unknown): AuthLinkGrant {
  const record = asRecord(raw);
  const grant: AuthLinkGrant = {};
  const roleId = asString(record.roleId);
  const verificationKind = asString(record.verificationKind);
  if (roleId) grant.roleId = roleId;
  if (verificationKind) grant.verificationKind = verificationKind as AuthLinkGrantKind;
  if (record.verificationPayload && typeof record.verificationPayload === "object") {
    grant.verificationPayload = record.verificationPayload as Record<string, unknown>;
  }
  return grant;
}

function normalizeAuthLink(raw: unknown): AuthLink {
  const record = asRecord(raw);
  return {
    token: asString(record.token),
    createdByUserId: asString(record.createdByUserId),
    createdAt: asString(record.createdAt),
    expiresAt: asString(record.expiresAt),
    maxUses: Math.max(0, Math.trunc(asNumber(record.maxUses, 1))),
    usedCount: Math.max(0, Math.trunc(asNumber(record.usedCount, 0))),
    audienceLabel: asString(record.audienceLabel),
    grant: normalizeGrant(record.grant),
  };
}

export async function createAdminAuthLink(
  adminToken: string,
  payload: AuthLinkCreatePayload,
): Promise<AuthLink> {
  const data = await apiSend<{ authLink?: unknown }>(
    "/api/admin/auth-link",
    withAuthHeader(adminToken, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );
  return normalizeAuthLink(data.authLink);
}

export async function fetchAdminAuthLinks(adminToken: string): Promise<AuthLinkListResponse> {
  const data = await apiGet<{ items?: unknown[]; total?: number }>(
    "/api/admin/auth-links",
    withAuthHeader(adminToken),
  );
  const items = Array.isArray(data.items) ? data.items.map(normalizeAuthLink) : [];
  return { items, total: data.total ?? items.length };
}

export async function revokeAdminAuthLink(adminToken: string, linkToken: string): Promise<void> {
  await apiSend(
    `/api/admin/auth-link/${encodeURIComponent(linkToken)}`,
    withAuthHeader(adminToken, { method: "DELETE" }),
  );
}

export function buildAuthLinkUrl(linkToken: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/join?link=${encodeURIComponent(linkToken)}`;
}

export function isAuthLinkExpired(link: AuthLink, now = Date.now()): boolean {
  if (!link.expiresAt) return false;
  const ms = Date.parse(link.expiresAt);
  if (!Number.isFinite(ms)) return false;
  return ms <= now;
}

export function isAuthLinkExhausted(link: AuthLink): boolean {
  return link.maxUses > 0 && link.usedCount >= link.maxUses;
}

export function getAuthLinkStatus(link: AuthLink): "active" | "expired" | "exhausted" {
  if (isAuthLinkExpired(link)) return "expired";
  if (isAuthLinkExhausted(link)) return "exhausted";
  return "active";
}
