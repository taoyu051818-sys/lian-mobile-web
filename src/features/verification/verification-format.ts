import {
  VERIFICATION_TAG_CAMPUS as VERIFICATION_LABEL_CAMPUS,
  VERIFICATION_TAG_ORG as VERIFICATION_LABEL_ORG,
  VERIFICATION_TAG_REALNAME as VERIFICATION_LABEL_REALNAME,
  VERIFICATION_TAG_MERCHANT as VERIFICATION_LABEL_MERCHANT,
  VERIFICATION_TAG_RUNNER as VERIFICATION_LABEL_RUNNER,
  VERIFICATION_STATUS_ACTIVE,
  VERIFICATION_STATUS_INACTIVE,
  VERIFICATION_STATUS_EXPIRED,
  VERIFICATION_STATUS_REVOKED,
} from "../../config/brand";
import type { VerificationRecord, VerificationTag } from "../../types/verification";
import {
  VERIFICATION_TAG_CAMPUS,
  VERIFICATION_TAG_ORG,
  VERIFICATION_TAG_REALNAME,
  VERIFICATION_TAG_MERCHANT,
  VERIFICATION_TAG_RUNNER,
} from "../../types/verification";

export interface VerificationDescriptor {
  tag: VerificationTag;
  label: string;
}

export const VERIFICATION_DESCRIPTORS: VerificationDescriptor[] = [
  { tag: VERIFICATION_TAG_CAMPUS, label: VERIFICATION_LABEL_CAMPUS },
  { tag: VERIFICATION_TAG_ORG, label: VERIFICATION_LABEL_ORG },
  { tag: VERIFICATION_TAG_REALNAME, label: VERIFICATION_LABEL_REALNAME },
  { tag: VERIFICATION_TAG_MERCHANT, label: VERIFICATION_LABEL_MERCHANT },
  { tag: VERIFICATION_TAG_RUNNER, label: VERIFICATION_LABEL_RUNNER },
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
