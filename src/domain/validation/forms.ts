import {
  VALIDATION_PASSWORD_MIN,
  VALIDATION_LOGIN_REQUIRED,
  VALIDATION_USERNAME_REQUIRED,
  VALIDATION_EMAIL_REQUIRED,
  VALIDATION_EMAIL_CODE_REQUIRED,
  VALIDATION_INTEREST_REQUIRED,
  VALIDATION_TITLE_REQUIRED,
  VALIDATION_TITLE_MAX,
  VALIDATION_BODY_REQUIRED,
  VALIDATION_BODY_MAX,
  VALIDATION_UPLOAD_IN_PROGRESS,
  VALIDATION_UPLOAD_INCOMPLETE,
} from "../../config/brand";

export const AUTH_PASSWORD_MIN_LENGTH = 8;
export const AUTH_USERNAME_MAX_LENGTH = 30;
export const AUTH_EMAIL_CODE_LENGTH = 6;
export const AUTH_MAX_INTEREST_SELECTIONS = 5;

const PUBLISH_TITLE_MAX_LENGTH = 40;
const PUBLISH_BODY_MAX_LENGTH = 300;

export interface AuthValidationFields {
  mode: "login" | "register";
  login: string;
  username: string;
  email: string;
  emailCode: string;
  password: string;
  selectedInterests: string[];
  interestSelectionRequired?: boolean;
}

export interface PublishValidationFields {
  title: string;
  body: string;
  uploading: boolean;
  selectedFileCount: number;
  uploadedImageCount: number;
  /**
   * True when the draft has a location bound (map_v2 pick or non-empty
   * `placeName`) and no image is attached. Per PRD V0.2 §2.2 a `place`
   * post is "无图 + 仅地点" — it doesn't carry body content (场所打卡 /
   * 地点签到). When this flag is set the body-required check is relaxed.
   * Title remains required (every post still needs a name).
   *
   * Optional so existing callers (event / merchant / trade flows) can omit
   * it; the body-required check then keeps the pre-existing behaviour.
   */
  isPlaceOnly?: boolean;
}

export function validateAuthForm(fields: AuthValidationFields): string {
  if (fields.password.length < AUTH_PASSWORD_MIN_LENGTH) {
    return VALIDATION_PASSWORD_MIN.replace("{n}", String(AUTH_PASSWORD_MIN_LENGTH));
  }
  if (fields.mode === "login") {
    if (!fields.login.trim()) return VALIDATION_LOGIN_REQUIRED;
    return "";
  }
  if (!fields.username.trim()) return VALIDATION_USERNAME_REQUIRED;
  if (!fields.email.trim()) {
    return VALIDATION_EMAIL_REQUIRED;
  }
  if (!fields.emailCode.trim()) {
    return VALIDATION_EMAIL_CODE_REQUIRED;
  }
  if (fields.interestSelectionRequired && !fields.selectedInterests.length) {
    return VALIDATION_INTEREST_REQUIRED;
  }
  return "";
}

export function toggleSelectedInterest(
  current: string[],
  id: string,
  max = AUTH_MAX_INTEREST_SELECTIONS,
): string[] {
  if (current.includes(id)) {
    return current.filter((item) => item !== id);
  }
  if (current.length >= max) {
    return current;
  }
  return [...current, id];
}

export function validatePublishForm(fields: PublishValidationFields): string {
  const normalizedTitle = fields.title.trim();
  if (!normalizedTitle) return VALIDATION_TITLE_REQUIRED;
  if (normalizedTitle.length > PUBLISH_TITLE_MAX_LENGTH) {
    return VALIDATION_TITLE_MAX.replace("{n}", String(PUBLISH_TITLE_MAX_LENGTH));
  }

  const normalizedBody = fields.body.trim();
  // PRD V0.2 §2.2 — `place` posts (无图 + 仅地点 → kind=place) are
  // location-only "场所打卡" / "签到" cards; their semantic content lives
  // in the bound place, not a body. The body-required check is relaxed
  // when the caller signals the draft is in that mode. Title still
  // applies. The body-too-long guard below is also kept (an empty body
  // trivially satisfies it, so place posts don't trip it either).
  if (!normalizedBody && !fields.isPlaceOnly) return VALIDATION_BODY_REQUIRED;
  if (normalizedBody.length > PUBLISH_BODY_MAX_LENGTH) {
    return VALIDATION_BODY_MAX.replace("{n}", String(PUBLISH_BODY_MAX_LENGTH));
  }

  if (fields.uploading) return VALIDATION_UPLOAD_IN_PROGRESS;
  if (fields.selectedFileCount !== fields.uploadedImageCount) {
    return VALIDATION_UPLOAD_INCOMPLETE;
  }
  return "";
}
