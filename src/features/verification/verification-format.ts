import {
  VERIFICATION_TAG_CAMPUS,
  VERIFICATION_TAG_ORG,
  VERIFICATION_TAG_REALNAME,
  VERIFICATION_TAG_MERCHANT,
  VERIFICATION_TAG_RUNNER,
  VERIFICATION_STATUS_ACTIVE,
  VERIFICATION_STATUS_INACTIVE,
  VERIFICATION_STATUS_EXPIRED,
  VERIFICATION_STATUS_REVOKED,
} from "../../config/brand";
import type { VerificationRecord, VerificationTag } from "../../types/verification";

export interface VerificationDescriptor {
  tag: VerificationTag;
  label: string;
}

export const VERIFICATION_DESCRIPTORS: VerificationDescriptor[] = [
  { tag: "campus_verified", label: VERIFICATION_TAG_CAMPUS },
  { tag: "org_member", label: VERIFICATION_TAG_ORG },
  { tag: "realname_verified", label: VERIFICATION_TAG_REALNAME },
  { tag: "merchant_verified", label: VERIFICATION_TAG_MERCHANT },
  { tag: "runner", label: VERIFICATION_TAG_RUNNER },
];

export function statusLabelFor(record: VerificationRecord | undefined): string {
  if (!record) return VERIFICATION_STATUS_INACTIVE;
  if (record.revokedAt) return VERIFICATION_STATUS_REVOKED;
  if (!record.active) return VERIFICATION_STATUS_EXPIRED;
  return VERIFICATION_STATUS_ACTIVE;
}

export function formatTimestamp(value: string | undefined): string {
  const raw = (value || "").trim();
  if (!raw) return "";
  const ts = Date.parse(raw);
  if (Number.isNaN(ts)) return raw;
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
