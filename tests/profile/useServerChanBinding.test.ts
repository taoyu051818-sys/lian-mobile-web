import { describe, expect, it, beforeEach, vi } from "vitest";

import {
  useServerChanBinding,
  __setServerChanBindingApiForTesting,
  __setServerChanBindingPlatformForTesting,
  __resetServerChanBindingForTesting,
} from "../../src/features/profile/useServerChanBinding";
import { LianApiError } from "../../src/api/http";
import type { ServerChanBinding } from "../../src/api/serverchan";

// Use a placeholder that is OBVIOUSLY not a real Server酱 SendKey.
// The repo's test inventory uses the constant prefix `SCT_TEST_PLACEHOLDER`
// to ensure no real secret slips into snapshots / fixtures / PR bodies.
const SCT_TEST_PLACEHOLDER = "SCT_TEST_PLACEHOLDER";

const BOUND: ServerChanBinding = {
  bound: true,
  enabled: true,
  createdAt: "2026-05-22T08:00:00Z",
  updatedAt: "2026-05-22T08:00:00Z",
};

describe("useServerChanBinding", () => {
  beforeEach(() => {
    __resetServerChanBindingForTesting();
  });

  it("starts in an unloaded state with no error", () => {
    const binding = useServerChanBinding();
    expect(binding.binding.value).toBeNull();
    expect(binding.isBound.value).toBe(false);
    expect(binding.isEnabled.value).toBe(false);
    expect(binding.loading.value).toBe(false);
    expect(binding.loadError.value).toBe("");
  });

  it("transitions through loading → bound on a successful fetch", async () => {
    let resolveFetch: ((value: ServerChanBinding) => void) | null = null;
    __setServerChanBindingApiForTesting({
      fetchBinding: () =>
        new Promise<ServerChanBinding>((resolve) => {
          resolveFetch = resolve;
        }),
    });
    const binding = useServerChanBinding();

    const promise = binding.load();
    expect(binding.loading.value).toBe(true);

    resolveFetch?.(BOUND);
    await promise;

    expect(binding.loading.value).toBe(false);
    expect(binding.isBound.value).toBe(true);
    expect(binding.isEnabled.value).toBe(true);
    expect(binding.binding.value?.createdAt).toBe(BOUND.createdAt);
    expect(binding.loadError.value).toBe("");
  });

  it("surfaces a brand-string load error when fetchBinding throws", async () => {
    __setServerChanBindingApiForTesting({
      fetchBinding: () => Promise.reject(new Error("offline")),
    });
    const binding = useServerChanBinding();
    await binding.load();

    expect(binding.loadError.value).toContain("加载失败");
    // Backend response body must NOT be echoed verbatim — extract checks the
    // user-visible string is the brand fallback, not the raw "offline".
    expect(binding.loadError.value).not.toContain("offline");
  });

  it("manual paste happy path: clears the input ref and flips to bound", async () => {
    const bindMock = vi.fn().mockResolvedValue(BOUND);
    __setServerChanBindingApiForTesting({ bind: bindMock });
    const binding = useServerChanBinding();

    binding.openManualForm();
    binding.manualKey.value = SCT_TEST_PLACEHOLDER;
    expect(binding.manualOpen.value).toBe(true);

    const ok = await binding.submitManualKey();

    expect(ok).toBe(true);
    expect(bindMock).toHaveBeenCalledWith(SCT_TEST_PLACEHOLDER);
    // Hard security boundary: the input ref MUST be cleared after the round-trip.
    expect(binding.manualKey.value).toBe("");
    expect(binding.isBound.value).toBe(true);
    expect(binding.manualOpen.value).toBe(false);
    expect(binding.submitError.value).toBe("");
  });

  it("manual paste empty input: does not call api, surfaces invalid-key copy", async () => {
    const bindMock = vi.fn();
    __setServerChanBindingApiForTesting({ bind: bindMock });
    const binding = useServerChanBinding();

    binding.openManualForm();
    binding.manualKey.value = "   ";
    const ok = await binding.submitManualKey();

    expect(ok).toBe(false);
    expect(bindMock).not.toHaveBeenCalled();
    expect(binding.submitError.value).toBe("SendKey 格式不正确");
  });

  it("manual paste BINDING_KEY_INVALID: surfaces 格式不正确 copy and preserves the input", async () => {
    __setServerChanBindingApiForTesting({
      bind: () => Promise.reject(new LianApiError("rejected", 400, "BINDING_KEY_INVALID", null)),
    });
    const binding = useServerChanBinding();

    binding.openManualForm();
    binding.manualKey.value = SCT_TEST_PLACEHOLDER;
    const ok = await binding.submitManualKey();

    expect(ok).toBe(false);
    expect(binding.submitError.value).toBe("SendKey 格式不正确");
    // On error we keep the manualKey so the user can correct it without
    // re-pasting. Only success clears it.
    expect(binding.manualKey.value).toBe(SCT_TEST_PLACEHOLDER);
    expect(binding.isBound.value).toBe(false);
  });

  it("manual paste 401: falls back to generic copy, never echoes backend body", async () => {
    __setServerChanBindingApiForTesting({
      bind: () => Promise.reject(new LianApiError("not authenticated", 401, "AUTH_REQUIRED", null)),
    });
    const binding = useServerChanBinding();

    binding.openManualForm();
    binding.manualKey.value = SCT_TEST_PLACEHOLDER;
    const ok = await binding.submitManualKey();

    expect(ok).toBe(false);
    expect(binding.submitError.value).toContain("绑定失败");
    expect(binding.submitError.value).not.toContain("not authenticated");
  });

  it("clearManualKey + closeManualForm both wipe the input ref", () => {
    const binding = useServerChanBinding();
    binding.manualKey.value = SCT_TEST_PLACEHOLDER;
    binding.clearManualKey();
    expect(binding.manualKey.value).toBe("");

    binding.openManualForm();
    binding.manualKey.value = SCT_TEST_PLACEHOLDER;
    binding.closeManualForm();
    expect(binding.manualKey.value).toBe("");
    expect(binding.manualOpen.value).toBe(false);
  });

  it("startBindFlow opens the returned url in a new window", async () => {
    const opened: string[] = [];
    __setServerChanBindingApiForTesting({
      fetchBindUrl: () => Promise.resolve({ url: "https://sct.ftqq.com/auth?cb=lian" }),
    });
    __setServerChanBindingPlatformForTesting({
      openExternalUrl: (url) => opened.push(url),
    });
    const binding = useServerChanBinding();

    const ok = await binding.startBindFlow();
    expect(ok).toBe(true);
    expect(opened).toEqual(["https://sct.ftqq.com/auth?cb=lian"]);
  });

  it("startBindFlow with empty url surfaces a brand error", async () => {
    __setServerChanBindingApiForTesting({
      fetchBindUrl: () => Promise.resolve({ url: "" }),
    });
    const binding = useServerChanBinding();

    const ok = await binding.startBindFlow();
    expect(ok).toBe(false);
    expect(binding.loadError.value).toContain("无法打开绑定页");
  });

  it("unbindNow flips state back to unbound on success", async () => {
    __setServerChanBindingApiForTesting({
      unbind: () => Promise.resolve({ ok: true }),
    });
    const binding = useServerChanBinding();
    binding.binding.value = BOUND;

    const ok = await binding.unbindNow();
    expect(ok).toBe(true);
    expect(binding.isBound.value).toBe(false);
  });

  it("unbindNow surfaces a brand error on failure and keeps prior bound state", async () => {
    __setServerChanBindingApiForTesting({
      unbind: () => Promise.reject(new Error("server down")),
    });
    const binding = useServerChanBinding();
    binding.binding.value = BOUND;

    const ok = await binding.unbindNow();
    expect(ok).toBe(false);
    expect(binding.loadError.value).toContain("解绑失败");
    expect(binding.isBound.value).toBe(true);
    // No backend body in user-visible copy.
    expect(binding.loadError.value).not.toContain("server down");
  });

  it("consumeCallbackSignal parses ?serverchan=bound|manual from the hash", () => {
    __setServerChanBindingPlatformForTesting({
      readLocationHash: () => "#/profile?settings=notifications&serverchan=bound",
    });
    const binding = useServerChanBinding();
    expect(binding.consumeCallbackSignal()).toBe("bound");

    __setServerChanBindingPlatformForTesting({
      readLocationHash: () => "#/profile?serverchan=manual",
    });
    expect(binding.consumeCallbackSignal()).toBe("manual");

    __setServerChanBindingPlatformForTesting({
      readLocationHash: () => "#/profile",
    });
    expect(binding.consumeCallbackSignal()).toBeNull();
  });
});
