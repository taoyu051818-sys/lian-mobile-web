export const AUTH_PASSWORD_MIN_LENGTH = 8;
export const AUTH_USERNAME_MAX_LENGTH = 30;
export const AUTH_EMAIL_CODE_LENGTH = 6;
export const AUTH_MAX_INTEREST_SELECTIONS = 5;

export const PUBLISH_TITLE_MAX_LENGTH = 40;
export const PUBLISH_BODY_MAX_LENGTH = 300;
export const PUBLISH_MAX_IMAGE_COUNT = 9;

export interface AuthValidationFields {
  mode: "login" | "register";
  login: string;
  username: string;
  email: string;
  emailCode: string;
  password: string;
  inviteCode: string;
  selectedInterests: string[];
  interestSelectionRequired?: boolean;
}

export interface PublishValidationFields {
  title: string;
  body: string;
  uploading: boolean;
  selectedFileCount: number;
  uploadedImageCount: number;
}

export function validateAuthForm(fields: AuthValidationFields): string {
  if (fields.password.length < AUTH_PASSWORD_MIN_LENGTH) {
    return `密码至少需要 ${AUTH_PASSWORD_MIN_LENGTH} 位。`;
  }
  if (fields.mode === "login") {
    if (!fields.login.trim()) return "请填写邮箱或昵称。";
    return "";
  }
  if (!fields.username.trim()) return "请填写昵称。";
  if (!fields.email.trim() && !fields.inviteCode.trim()) {
    return "请填写高校邮箱，或填写邀请码。";
  }
  if (fields.email.trim() && !fields.emailCode.trim()) {
    return "高校邮箱注册需要填写验证码。";
  }
  if (fields.interestSelectionRequired && !fields.selectedInterests.length) {
    return "至少选择一个兴趣，用来初始化推荐流。";
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
  if (!normalizedTitle) return "请填写标题。";
  if (normalizedTitle.length > PUBLISH_TITLE_MAX_LENGTH) {
    return `标题最多 ${PUBLISH_TITLE_MAX_LENGTH} 个字。`;
  }

  const normalizedBody = fields.body.trim();
  if (!normalizedBody) return "请填写正文。";
  if (normalizedBody.length > PUBLISH_BODY_MAX_LENGTH) {
    return `正文最多 ${PUBLISH_BODY_MAX_LENGTH} 个字。`;
  }

  if (fields.uploading) return "图片还在上传，稍等一下再发布。";
  if (fields.selectedFileCount !== fields.uploadedImageCount) {
    return "还有图片没有上传成功，请重新选择或移除。";
  }
  return "";
}
