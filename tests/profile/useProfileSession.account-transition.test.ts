import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/api/profile", () => ({
  fetchAuthMe: vi.fn(),
}));

import * as profileApi from "../../src/api/profile";
import { useProfileSession } from "../../src/features/profile/useProfileSession";

const fetchAuthMeMock = vi.mocked(profileApi.fetchAuthMe);

beforeEach(() => {
  fetchAuthMeMock.mockReset();
});

describe("useProfileSession refresh candidates", () => {
  it("returns a different-account candidate without mutating the live user", async () => {
    fetchAuthMeMock.mockResolvedValueOnce({ id: "user-b", username: "B" });
    const session = useProfileSession();
    session.user.value = { id: "user-a", username: "A" };

    await expect(session.refreshCurrentSession()).resolves.toEqual({
      id: "user-b",
      username: "B",
    });
    expect(session.user.value).toEqual({ id: "user-a", username: "A" });
  });

  it("returns null without mutating the live user when auth resolves guest", async () => {
    fetchAuthMeMock.mockResolvedValueOnce(null);
    const session = useProfileSession();
    session.user.value = { id: "user-a", username: "A" };

    await expect(session.refreshCurrentSession()).resolves.toBeNull();
    expect(session.user.value).toEqual({ id: "user-a", username: "A" });
  });

  it("soft-fails to null without mutating the live user when auth lookup rejects", async () => {
    fetchAuthMeMock.mockRejectedValueOnce(new Error("auth unavailable"));
    const session = useProfileSession();
    session.user.value = { id: "user-a", username: "A" };

    await expect(session.refreshCurrentSession()).resolves.toBeNull();
    expect(session.user.value).toEqual({ id: "user-a", username: "A" });
  });
});
