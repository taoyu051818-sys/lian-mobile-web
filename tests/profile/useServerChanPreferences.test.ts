import { describe, expect, it, beforeEach, vi } from "vitest";

import {
  useServerChanPreferences,
  __setServerChanPreferencesApiForTesting,
  __resetServerChanPreferencesForTesting,
} from "../../src/features/profile/useServerChanPreferences";
import type { ServerChanPreferences } from "../../src/api/serverchan";

const ALL_OFF: ServerChanPreferences = {
  eventStartingReminder: false,
  rewardSettledReminder: false,
};

const ALL_ON: ServerChanPreferences = {
  eventStartingReminder: true,
  rewardSettledReminder: true,
};

describe("useServerChanPreferences", () => {
  beforeEach(() => {
    __resetServerChanPreferencesForTesting();
  });

  it("starts with no preferences loaded", () => {
    const prefs = useServerChanPreferences();
    expect(prefs.preferences.value).toBeNull();
    expect(prefs.isReady.value).toBe(false);
    expect(prefs.loading.value).toBe(false);
  });

  it("loads preferences via the api seam and sets ready=true", async () => {
    __setServerChanPreferencesApiForTesting({
      fetch: () => Promise.resolve(ALL_OFF),
    });
    const prefs = useServerChanPreferences();

    await prefs.load();

    expect(prefs.isReady.value).toBe(true);
    expect(prefs.preferences.value).toEqual(ALL_OFF);
  });

  it("toggle round-trip: optimistic flip → server-confirmed value", async () => {
    const updateMock = vi.fn().mockResolvedValue(ALL_ON);
    __setServerChanPreferencesApiForTesting({
      fetch: () => Promise.resolve(ALL_OFF),
      update: updateMock,
    });
    const prefs = useServerChanPreferences();
    await prefs.load();

    const ok = await prefs.toggle("eventStartingReminder", true);

    expect(ok).toBe(true);
    expect(updateMock).toHaveBeenCalledWith({
      eventStartingReminder: true,
      rewardSettledReminder: false,
    });
    expect(prefs.preferences.value).toEqual(ALL_ON);
    expect(prefs.saving.value).toBe(false);
    expect(prefs.saveError.value).toBe("");
  });

  it("toggle revert: optimistic flip rolled back on update failure", async () => {
    __setServerChanPreferencesApiForTesting({
      fetch: () => Promise.resolve(ALL_OFF),
      update: () => Promise.reject(new Error("422 backend say no")),
    });
    const prefs = useServerChanPreferences();
    await prefs.load();

    const ok = await prefs.toggle("eventStartingReminder", true);

    expect(ok).toBe(false);
    // Reverted to entering-saving snapshot, NOT left at the optimistic value.
    expect(prefs.preferences.value).toEqual(ALL_OFF);
    expect(prefs.saveError.value).toContain("没有保存成功");
    // Backend body must NOT be echoed.
    expect(prefs.saveError.value).not.toContain("422 backend say no");
  });

  it("toggle is a no-op while a previous save is in flight", async () => {
    let resolveFirst: ((value: ServerChanPreferences) => void) | null = null;
    const updateMock = vi.fn().mockImplementation(
      () =>
        new Promise<ServerChanPreferences>((resolve) => {
          resolveFirst = resolve;
        }),
    );
    __setServerChanPreferencesApiForTesting({
      fetch: () => Promise.resolve(ALL_OFF),
      update: updateMock,
    });
    const prefs = useServerChanPreferences();
    await prefs.load();

    const firstPromise = prefs.toggle("eventStartingReminder", true);
    expect(prefs.saving.value).toBe(true);

    // Second toggle while first is in-flight: rejected.
    const second = await prefs.toggle("rewardSettledReminder", true);
    expect(second).toBe(false);
    expect(updateMock).toHaveBeenCalledTimes(1);

    resolveFirst?.(ALL_ON);
    await firstPromise;
  });

  it("setErrandOrderReminder returns false when orderId is empty", async () => {
    const setErrandOrderMock = vi.fn();
    __setServerChanPreferencesApiForTesting({
      setErrandOrder: setErrandOrderMock,
    });
    const prefs = useServerChanPreferences();
    const ok = await prefs.setErrandOrderReminder("", true);
    expect(ok).toBe(false);
    expect(setErrandOrderMock).not.toHaveBeenCalled();
  });

  it("setErrandOrderReminder forwards orderId + flag to the api seam", async () => {
    const setErrandOrderMock = vi.fn().mockResolvedValue({ enabled: true });
    __setServerChanPreferencesApiForTesting({
      setErrandOrder: setErrandOrderMock,
    });
    const prefs = useServerChanPreferences();
    const ok = await prefs.setErrandOrderReminder("ord-7", true);
    expect(ok).toBe(true);
    expect(setErrandOrderMock).toHaveBeenCalledWith("ord-7", true);
  });

  it("setErrandOrderReminder surfaces a brand error on rejection", async () => {
    __setServerChanPreferencesApiForTesting({
      setErrandOrder: () => Promise.reject(new Error("network")),
    });
    const prefs = useServerChanPreferences();
    const ok = await prefs.setErrandOrderReminder("ord-7", true);
    expect(ok).toBe(false);
    expect(prefs.saveError.value).toContain("没有保存成功");
    expect(prefs.saveError.value).not.toContain("network");
  });

  it("load failure surfaces the brand load-error string and never echoes backend body", async () => {
    __setServerChanPreferencesApiForTesting({
      fetch: () => Promise.reject(new Error("404 not found")),
    });
    const prefs = useServerChanPreferences();
    await prefs.load();
    expect(prefs.loadError.value).toContain("加载失败");
    expect(prefs.loadError.value).not.toContain("404");
  });
});
