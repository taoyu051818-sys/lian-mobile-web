export const VERIFICATION_TAG_CAMPUS = "campus_verified";
export const VERIFICATION_TAG_ORG = "org_member";
export const VERIFICATION_TAG_REALNAME = "realname_verified";
export const VERIFICATION_TAG_MERCHANT = "merchant_verified";
export const VERIFICATION_TAG_RUNNER = "runner";

export const VERIFICATION_TAGS = [
  VERIFICATION_TAG_CAMPUS,
  VERIFICATION_TAG_ORG,
  VERIFICATION_TAG_REALNAME,
  VERIFICATION_TAG_MERCHANT,
  VERIFICATION_TAG_RUNNER,
] as const;

export type VerificationTag = (typeof VERIFICATION_TAGS)[number];

export interface VerificationRecord {
  tag: VerificationTag;
  grantedAt: string;
  expiresAt: string;
  revokedAt: string;
  source: string;
  active: boolean;
}

export type VerificationState = Partial<Record<VerificationTag, VerificationRecord>>;

export interface CampusEmailSendResponse {
  ok: boolean;
  expiresInSeconds?: number;
  institution?: string;
}

export interface CampusEmailConfirmResponse {
  ok: boolean;
  user?: {
    id?: string;
    email?: string;
    institution?: string;
    tags?: string[];
    verificationTags?: string[];
    verificationState?: VerificationState;
  };
}
