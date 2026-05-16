import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  AUTH_EMAIL_CODE_DEFAULT_COOLDOWN_SECONDS,
  formatEmailCodeHint,
  formatEmailCodeRateLimitMessage,
} from "../../src/features/auth/useAuthForm";

function readRepoFile(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

describe("auth email-code cooldown copy", () => {
  it("extends success copy with the remaining cooldown", () => {
    expect(
      formatEmailCodeHint("验证码已发送，请查看邮箱。", AUTH_EMAIL_CODE_DEFAULT_COOLDOWN_SECONDS),
    ).toContain("60 秒后可重新发送");
  });

  it("falls back to a generic cooldown hint when no custom message exists", () => {
    expect(formatEmailCodeHint("", 18)).toBe("验证码发送后会进入冷却，请在 18 秒后重试。");
  });

  it("formats Retry-After aware and fallback rate-limit copy truthfully", () => {
    expect(formatEmailCodeRateLimitMessage(42)).toBe("发送太频繁，请在 42 秒后再试。");
    expect(formatEmailCodeRateLimitMessage(null)).toContain("60 秒冷却处理");
  });
});

describe("AuthPanel cooldown wiring", () => {
  const source = readRepoFile("../../src/features/auth/AuthPanel.vue");

  it("uses the cooldown-aware resend label", () => {
    expect(source).toContain("emailCodeButtonLabel");
  });

  it("disables the send button when cooldown or in-flight state blocks retry", () => {
    expect(source).toContain(':disabled="!canRequestEmailCode"');
  });
});
