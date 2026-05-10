import { describe, it, expect } from "vitest";
import { validateAuthForm, type AuthFormFields } from "../../src/views/auth/useAuthForm";

function loginFields(overrides: Partial<AuthFormFields> = {}): AuthFormFields {
  return {
    mode: "login",
    login: "user@example.com",
    username: "",
    email: "",
    emailCode: "",
    password: "securepass",
    inviteCode: "",
    selectedInterests: [],
    ...overrides,
  };
}

function registerFields(overrides: Partial<AuthFormFields> = {}): AuthFormFields {
  return {
    mode: "register",
    login: "",
    username: "小明",
    email: "xm@edu.cn",
    emailCode: "123456",
    password: "securepass",
    inviteCode: "",
    selectedInterests: ["art"],
    ...overrides,
  };
}

describe("validateAuthForm", () => {
  describe("password", () => {
    it("rejects password shorter than 8 characters", () => {
      expect(validateAuthForm(loginFields({ password: "short" }))).toContain("密码");
    });

    it("accepts password of exactly 8 characters", () => {
      expect(validateAuthForm(loginFields({ password: "12345678" }))).toBe("");
    });
  });

  describe("login mode", () => {
    it("rejects empty login field", () => {
      expect(validateAuthForm(loginFields({ login: "" }))).toContain("邮箱或昵称");
    });

    it("rejects whitespace-only login field", () => {
      expect(validateAuthForm(loginFields({ login: "   " }))).toContain("邮箱或昵称");
    });

    it("returns empty string for valid login", () => {
      expect(validateAuthForm(loginFields())).toBe("");
    });
  });

  describe("register mode", () => {
    it("rejects empty username", () => {
      expect(validateAuthForm(registerFields({ username: "" }))).toContain("昵称");
    });

    it("rejects whitespace-only username", () => {
      expect(validateAuthForm(registerFields({ username: "   " }))).toContain("昵称");
    });

    it("rejects when both email and inviteCode are empty", () => {
      expect(validateAuthForm(registerFields({ email: "", inviteCode: "" }))).toContain("高校邮箱");
    });

    it("rejects email without emailCode", () => {
      expect(validateAuthForm(registerFields({ emailCode: "" }))).toContain("验证码");
    });

    it("accepts inviteCode without email", () => {
      expect(
        validateAuthForm(registerFields({ email: "", emailCode: "", inviteCode: "INV123" })),
      ).toBe("");
    });

    it("rejects empty selectedInterests", () => {
      expect(validateAuthForm(registerFields({ selectedInterests: [] }))).toContain("兴趣");
    });

    it("returns empty string for valid register with email", () => {
      expect(validateAuthForm(registerFields())).toBe("");
    });

    it("returns empty string for valid register with inviteCode", () => {
      expect(
        validateAuthForm(
          registerFields({ email: "", emailCode: "", inviteCode: "INV" }),
        ),
      ).toBe("");
    });
  });
});
