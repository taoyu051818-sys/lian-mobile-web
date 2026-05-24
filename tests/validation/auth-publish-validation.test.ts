import { describe, expect, it } from "vitest";
import {
  AUTH_MAX_INTEREST_SELECTIONS,
  PUBLISH_BODY_MAX_LENGTH,
  PUBLISH_TITLE_MAX_LENGTH,
  toggleSelectedInterest,
  validateAuthForm,
  validatePublishForm,
  type AuthValidationFields,
  type PublishValidationFields,
} from "../../src/domain/validation/forms";

function createAuthFields(overrides: Partial<AuthValidationFields> = {}): AuthValidationFields {
  return {
    mode: "login",
    login: "student@example.edu",
    username: "同学",
    email: "student@example.edu",
    emailCode: "123456",
    password: "12345678",
    selectedInterests: [],
    interestSelectionRequired: false,
    ...overrides,
  };
}

function createPublishFields(
  overrides: Partial<PublishValidationFields> = {},
): PublishValidationFields {
  return {
    title: "标题",
    body: "正文",
    uploading: false,
    selectedFileCount: 0,
    uploadedImageCount: 0,
    ...overrides,
  };
}

describe("auth and publish validation helpers", () => {
  it("keeps auth password validation ahead of mode-specific rules", () => {
    expect(validateAuthForm(createAuthFields({ password: "1234567", login: "" }))).toBe(
      "密码至少需要 8 位。",
    );
  });

  it("requires a login identifier in login mode", () => {
    expect(validateAuthForm(createAuthFields({ login: "   " }))).toBe("请填写邮箱或昵称。");
  });

  it("requires register mode to provide username and contact proof", () => {
    expect(
      validateAuthForm(
        createAuthFields({
          mode: "register",
          username: "   ",
          email: "",
          emailCode: "",
        }),
      ),
    ).toBe("请填写昵称。");

    expect(
      validateAuthForm(
        createAuthFields({
          mode: "register",
          email: "",
          emailCode: "",
        }),
      ),
    ).toBe("请填写高校邮箱。");

    expect(
      validateAuthForm(
        createAuthFields({
          mode: "register",
          email: "student@example.edu",
          emailCode: "",
        }),
      ),
    ).toBe("高校邮箱注册需要填写验证码。");
  });

  it("requires at least one interest when the auth flow marks it required", () => {
    expect(
      validateAuthForm(
        createAuthFields({
          mode: "register",
          selectedInterests: [],
          interestSelectionRequired: true,
        }),
      ),
    ).toBe("至少选择一个兴趣，用来初始化推荐流。");
  });

  it("toggles selected interests and preserves the max selection cap", () => {
    expect(toggleSelectedInterest(["music"], "music")).toEqual([]);
    expect(toggleSelectedInterest(["music"], "art")).toEqual(["music", "art"]);

    const fullSelection = Array.from(
      { length: AUTH_MAX_INTEREST_SELECTIONS },
      (_, index) => `tag-${index}`,
    );
    expect(toggleSelectedInterest(fullSelection, "extra-tag")).toEqual(fullSelection);
  });

  it("validates publish title and body requirements with shared limits", () => {
    expect(validatePublishForm(createPublishFields({ title: "   " }))).toBe("请填写标题。");
    expect(
      validatePublishForm(
        createPublishFields({ title: "标".repeat(PUBLISH_TITLE_MAX_LENGTH + 1) }),
      ),
    ).toBe(`标题最多 ${PUBLISH_TITLE_MAX_LENGTH} 个字。`);
    expect(validatePublishForm(createPublishFields({ body: "   " }))).toBe("请填写正文。");
    expect(
      validatePublishForm(createPublishFields({ body: "文".repeat(PUBLISH_BODY_MAX_LENGTH + 1) })),
    ).toBe(`正文最多 ${PUBLISH_BODY_MAX_LENGTH} 个字。`);
  });

  it("blocks publish submission while uploads are incomplete", () => {
    expect(validatePublishForm(createPublishFields({ uploading: true }))).toBe(
      "图片还在上传，稍等一下再发布。",
    );
    expect(
      validatePublishForm(
        createPublishFields({
          selectedFileCount: 2,
          uploadedImageCount: 1,
        }),
      ),
    ).toBe("还有图片没有上传成功，请重新选择或移除。");
  });

  // PRD V0.2 §2.2 — `place` posts are 无图 + 仅地点 + 无 body cards. The
  // body-required check relaxes when `isPlaceOnly` is true so the user can
  // submit a location-only "签到" draft (Gap 1 fix). Title remains required.
  it("relaxes body-required for place-only drafts (Gap 1 fix)", () => {
    expect(
      validatePublishForm(
        createPublishFields({
          title: "在图书馆",
          body: "",
          isPlaceOnly: true,
        }),
      ),
    ).toBe("");
  });

  it("still requires title for place-only drafts", () => {
    expect(
      validatePublishForm(
        createPublishFields({
          title: "   ",
          body: "",
          isPlaceOnly: true,
        }),
      ),
    ).toBe("请填写标题。");
  });

  it("place-only flag does not bypass body-too-long guard (defensive)", () => {
    expect(
      validatePublishForm(
        createPublishFields({
          title: "图书馆",
          body: "文".repeat(PUBLISH_BODY_MAX_LENGTH + 1),
          isPlaceOnly: true,
        }),
      ),
    ).toBe(`正文最多 ${PUBLISH_BODY_MAX_LENGTH} 个字。`);
  });
});
