/**
 * `useErrandHelpCta` — wave 3-A composable contract test (Apple-gap mw#827).
 *
 * The composable owns the precedence rules between the four orthogonal
 * signals that drive the merchant-detail errand CTA: server availability,
 * merchant identity, viewer permission, and the local action lifecycle
 * (loading / success / failure). The unit suite locks the rules so a
 * regression in any one of them surfaces immediately.
 */
import { describe, expect, it } from "vitest";
import { ref } from "vue";
import { useErrandHelpCta } from "../../src/features/merchant/useErrandHelpCta";

function makeCta(
  overrides: {
    available?: boolean | undefined;
    merchantPostId?: number | null;
    hasPermission?: boolean;
    blockedReason?: string;
  } = {},
) {
  return useErrandHelpCta({
    available: ref(overrides.available),
    merchantPostId: ref(overrides.merchantPostId ?? 0),
    hasPermission: ref(overrides.hasPermission ?? true),
    blockedReason: ref(overrides.blockedReason ?? ""),
  });
}

describe("useErrandHelpCta — derived state", () => {
  it("renders enabled when available, has merchant id, and viewer has permission", () => {
    const cta = makeCta({ available: true, merchantPostId: 99, hasPermission: true });
    expect(cta.state.value).toBe("enabled");
    expect(cta.clickable.value).toBe(true);
  });

  it("renders disabled-state when available but the merchant id is missing", () => {
    // The composable will not dispatch into the route singleton without a
    // positive id. Visually the button reads as disabled (state-blocked).
    const cta = makeCta({ available: true, merchantPostId: 0, hasPermission: true });
    expect(cta.state.value).toBe("disabled");
    expect(cta.clickable.value).toBe(false);
  });

  it("renders reason (permission cause) when viewer cannot place an order", () => {
    // The spec calls out 「未认证商家」 / 「未认证校园」 as the canonical
    // disabled-permission case. Permission gate fires only when the entry
    // is otherwise available and the merchant id is good.
    const cta = makeCta({ available: true, merchantPostId: 99, hasPermission: false });
    expect(cta.state.value).toBe("reason");
    expect(cta.clickable.value).toBe(false);
  });

  it("renders reason (state cause) when the backend marks the entry unavailable", () => {
    // The backend signal `available=false` reads as state-blocked. The CTA
    // surface preserves the reason copy that comes from the server.
    const cta = makeCta({
      available: false,
      merchantPostId: 99,
      hasPermission: true,
      blockedReason: "商家暂时关闭了帮我取入口。",
    });
    expect(cta.state.value).toBe("reason");
    expect(cta.clickable.value).toBe(false);
  });

  it("reports clickable=false when state is loading even before runClick is called", async () => {
    const cta = makeCta({ available: true, merchantPostId: 99, hasPermission: true });
    const promise = cta.runClick(async () => {
      // While the click handler is in flight the state must read loading
      // and clickable must be false so a re-tap does not double-fire.
      expect(cta.state.value).toBe("loading");
      expect(cta.clickable.value).toBe(false);
    });
    await promise;
  });
});

describe("useErrandHelpCta — runClick lifecycle", () => {
  it("latches success after a successful click and stays in success on re-tap", async () => {
    const cta = makeCta({ available: true, merchantPostId: 99, hasPermission: true });
    let calls = 0;
    await cta.runClick(() => {
      calls++;
    });
    expect(cta.state.value).toBe("success");
    expect(cta.success.value).toBe(true);
    expect(calls).toBe(1);
    // Re-tap is a no-op once the success bit is latched (clickable=false).
    await cta.runClick(() => {
      calls++;
    });
    expect(calls).toBe(1);
  });

  it("captures the error message into failure state when the handler throws", async () => {
    const cta = makeCta({ available: true, merchantPostId: 99, hasPermission: true });
    await cta.runClick(() => {
      throw new Error("network down");
    });
    expect(cta.state.value).toBe("failure");
    expect(cta.failure.value).toBe(true);
    expect(cta.failureMessage.value).toBe("network down");
  });

  it("does not invoke the handler when blocked by permission gate", async () => {
    const cta = makeCta({ available: true, merchantPostId: 99, hasPermission: false });
    let calls = 0;
    await cta.runClick(() => {
      calls++;
    });
    expect(calls).toBe(0);
    // State stays in the reason branch — the click did not even run.
    expect(cta.state.value).toBe("reason");
  });

  it("reset() clears latched success / failure / loading bits", async () => {
    const cta = makeCta({ available: true, merchantPostId: 99, hasPermission: true });
    await cta.runClick(() => {
      throw new Error("fail");
    });
    expect(cta.state.value).toBe("failure");
    cta.reset();
    expect(cta.state.value).toBe("enabled");
    expect(cta.failure.value).toBe(false);
    expect(cta.failureMessage.value).toBe("");
  });
});
