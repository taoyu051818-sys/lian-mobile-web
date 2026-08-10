import { describe, expect, it } from "vitest";
import {
  AUTH_MAX_INTEREST_SELECTIONS,
  toggleSelectedInterest,
  validateAuthForm,
  validatePublishForm,
  type AuthValidationFields,
  type PublishValidationFields,
} from "../../src/domain/validation/forms";
import {
  VALIDATION_BODY_MAX,
  VALIDATION_BODY_REQUIRED,
  VALIDATION_EMAIL_CODE_REQUIRED,
  VALIDATION_EMAIL_REQUIRED,
  VALIDATION_INTEREST_REQUIRED,
  VALIDATION_LOGIN_REQUIRED,
  VALIDATION_PASSWORD_MIN,
  VALIDATION_TITLE_MAX,
  VALIDATION_TITLE_REQUIRED,
  VALIDATION_UPLOAD_INCOMPLETE,
  VALIDATION_UPLOAD_IN_PROGRESS,
  VALIDATION_USERNAME_REQUIRED,
} from "../../src/config/brand";

const PUBLISH_TITLE_LIMIT = 40;
const PUBLISH_BODY_LIMIT = 300;

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
      VALIDATION_PASSWORD_MIN.replace("{n}", "8"),
    );
  });

  it("requires a login identifier in login mode", () => {
    expect(validateAuthForm(createAuthFields({ login: "   " }))).toBe(VALIDATION_LOGIN_REQUIRED);
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
    ).toBe(VALIDATION_USERNAME_REQUIRED);

    expect(
      validateAuthForm(
        createAuthFields({
          mode: "register",
          email: "",
          emailCode: "",
        }),
      ),
    ).toBe(VALIDATION_EMAIL_REQUIRED);

    expect(
      validateAuthForm(
        createAuthFields({
          mode: "register",
          email: "student@example.edu",
          emailCode: "",
        }),
      ),
    ).toBe(VALIDATION_EMAIL_CODE_REQUIRED);
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
    ).toBe(VALIDATION_INTEREST_REQUIRED);
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

  it("validates publish title and body requirements at the product limits", () => {
    expect(validatePublishForm(createPublishFields({ title: "   " }))).toBe(
      VALIDATION_TITLE_REQUIRED,
    );
    expect(
      validatePublishForm(createPublishFields({ title: "标".repeat(PUBLISH_TITLE_LIMIT) })),
    ).toBe("");
    expect(
      validatePublishForm(createPublishFields({ title: "标".repeat(PUBLISH_TITLE_LIMIT + 1) })),
    ).toBe(VALIDATION_TITLE_MAX.replace("{n}", String(PUBLISH_TITLE_LIMIT)));
    expect(validatePublishForm(createPublishFields({ body: "   " }))).toBe(
      VALIDATION_BODY_REQUIRED,
    );
    expect(
      validatePublishForm(createPublishFields({ body: "文".repeat(PUBLISH_BODY_LIMIT) })),
    ).toBe("");
    expect(
      validatePublishForm(createPublishFields({ body: "文".repeat(PUBLISH_BODY_LIMIT + 1) })),
    ).toBe(VALIDATION_BODY_MAX.replace("{n}", String(PUBLISH_BODY_LIMIT)));
  });

  it("blocks publish submission while uploads are incomplete", () => {
    expect(validatePublishForm(createPublishFields({ uploading: true }))).toBe(
      VALIDATION_UPLOAD_IN_PROGRESS,
    );
    expect(
      validatePublishForm(
        createPublishFields({
          selectedFileCount: 2,
          uploadedImageCount: 1,
        }),
      ),
    ).toBe(VALIDATION_UPLOAD_INCOMPLETE);
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
    ).toBe(VALIDATION_TITLE_REQUIRED);
  });

  it("place-only flag does not bypass body-too-long guard (defensive)", () => {
    expect(
      validatePublishForm(
        createPublishFields({
          title: "图书馆",
          body: "文".repeat(PUBLISH_BODY_LIMIT + 1),
          isPlaceOnly: true,
        }),
      ),
    ).toBe(VALIDATION_BODY_MAX.replace("{n}", String(PUBLISH_BODY_LIMIT)));
  });
});
