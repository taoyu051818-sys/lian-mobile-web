import { describe, it, expect, vi } from "vitest";
import type { AuthRulesResponse } from "../../src/api/auth";
import {
  loadAuthInterestSettings,
  toggleSelectedInterest,
  validateAuthForm,
  type AuthFormFields,
} from "../../src/features/auth/useAuthForm";

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
    interestSelectionRequired: false,
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
    interestSelectionRequired: false,
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

    it("accepts empty selectedInterests when onboarding can skip preferences", () => {
      expect(validateAuthForm(registerFields({ selectedInterests: [] }))).toBe("");
    });

    it("rejects empty selectedInterests when onboarding requires them", () => {
      expect(
        validateAuthForm(
          registerFields({ selectedInterests: [], interestSelectionRequired: true }),
        ),
      ).toContain("兴趣");
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

describe("loadAuthInterestSettings", () => {
  it("returns ready state when rules include interests", async () => {
    const rules: AuthRulesResponse = {
      interests: [{ id: "art", label: "艺术", description: "画展和创作" }],
    };
    const fetchRules = vi.fn<() => Promise<AuthRulesResponse>>().mockResolvedValue(rules);

    await expect(loadAuthInterestSettings(fetchRules)).resolves.toEqual({
      options: rules.interests,
      status: "ready",
      required: false,
    });
  });

  it("keeps required state only when the API explicitly marks it", async () => {
    const fetchRules = vi.fn<() => Promise<AuthRulesResponse>>().mockResolvedValue({
      interests: [{ id: "art", label: "艺术", description: "画展和创作" }],
      interestsRequired: true,
    });

    await expect(loadAuthInterestSettings(fetchRules)).resolves.toEqual({
      options: [{ id: "art", label: "艺术", description: "画展和创作" }],
      status: "ready",
      required: true,
    });
  });

  it("returns empty state when the API responds without choices", async () => {
    const fetchRules = vi.fn<() => Promise<AuthRulesResponse>>().mockResolvedValue({
      interests: [],
    });

    await expect(loadAuthInterestSettings(fetchRules)).resolves.toEqual({
      options: [],
      status: "empty",
      required: false,
    });
  });

  it("returns unavailable state when auth rules fail", async () => {
    const fetchRules = vi.fn<() => Promise<AuthRulesResponse>>().mockRejectedValue(new Error("boom"));

    await expect(loadAuthInterestSettings(fetchRules)).resolves.toEqual({
      options: [],
      status: "unavailable",
      required: false,
    });
  });
});

describe("toggleSelectedInterest", () => {
  it("adds an interest from zero to one selection", () => {
    expect(toggleSelectedInterest([], "art")).toEqual(["art"]);
  });

  it("removes an already-selected interest", () => {
    expect(toggleSelectedInterest(["art", "music"], "art")).toEqual(["music"]);
  });

  it("does not add a sixth interest", () => {
    expect(
      toggleSelectedInterest(["a", "b", "c", "d", "e"], "f"),
    ).toEqual(["a", "b", "c", "d", "e"]);
  });
});
