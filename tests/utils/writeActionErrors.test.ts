import { describe, expect, it } from "vitest";

import { LianApiError } from "../../src/api/http";
import { resolveWriteActionErrorMessage } from "../../src/utils/writeActionErrors";

describe("resolveWriteActionErrorMessage", () => {
  it("maps upstream publish failures to safe recovery copy", () => {
    const message = resolveWriteActionErrorMessage(
      "publish",
      new LianApiError("Service unavailable", 503, "UPSTREAM_ERROR", null),
    );

    expect(message).toBe("发布暂时没成功，内容已保留，请稍后重试。");
    expect(message).not.toContain("Service unavailable");
    expect(message).not.toContain("UPSTREAM_ERROR");
  });

  it("maps reply validation payloads to safe copy without leaking raw JSON", () => {
    const rawEnvelope =
      '{"status":{"code":"BAD_REQUEST","message":"Required parameters were missing from this API call: content"}}';
    const message = resolveWriteActionErrorMessage("reply", new Error(rawEnvelope));

    expect(message).toBe("回复发送失败，内容已保留，请检查后重试。");
    expect(message).not.toContain("Required parameters were missing");
    expect(message).not.toContain("BAD_REQUEST");
  });

  it("maps auth failures to relogin copy", () => {
    const message = resolveWriteActionErrorMessage(
      "publish",
      new LianApiError("unauthorized", 401, "UNAUTHORIZED", null),
    );

    expect(message).toBe("登录状态已失效，内容已保留，请重新登录后再发布。");
  });

  it("maps network failures to retry-after-checking-connection copy", () => {
    const message = resolveWriteActionErrorMessage("reply", new TypeError("Failed to fetch"));

    expect(message).toBe("网络有点不稳，内容已保留，请检查连接后重试。");
  });

  it("maps rate-limit failures to paced retry copy", () => {
    const message = resolveWriteActionErrorMessage(
      "reply",
      new LianApiError("发送太频繁，请稍后再试。", 429, "RATE_LIMIT", 60),
    );

    expect(message).toBe("操作太频繁了，内容已保留，请稍后再试。");
  });
});
