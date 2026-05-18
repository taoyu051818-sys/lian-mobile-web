export type VerificationTag =
  | "campus_verified"
  | "org_member"
  | "realname_verified"
  | "merchant_verified"
  | "runner";

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
