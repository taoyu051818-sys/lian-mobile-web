import { afterEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import { LianApiError } from "../../src/api/http";
import { useAdminConsole } from "../../src/features/admin/useAdminConsole";
import type { AdminReportListResponse } from "../../src/types/admin";

const fetchAdminReports = vi.hoisted(() => vi.fn<[], Promise<AdminReportListResponse>>());

vi.mock("../../src/api/admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/api/admin")>();
  return {
    ...actual,
    fetchAdminReports,
  };
});

describe("useAdminConsole admin auth mode", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads admin data through the session when session-admin mode has no fallback token", async () => {
    const token = ref("stored-token");
    const sessionAdmin = ref(true);
    const onTokenInvalid = vi.fn();
    fetchAdminReports.mockResolvedValue({ items: [], total: 0 });

    const console = useAdminConsole({ token, sessionAdmin, onTokenInvalid });

    await console.loadReports("pending");

    expect(fetchAdminReports).toHaveBeenCalledWith("", { status: "pending", limit: 100 });
    expect(onTokenInvalid).not.toHaveBeenCalled();
  });

  it("uses the explicit ops fallback token when session-admin mode is unavailable", async () => {
    const token = ref("ops-token");
    const sessionAdmin = ref(false);
    const onTokenInvalid = vi.fn();
    fetchAdminReports.mockResolvedValue({ items: [], total: 0 });

    const console = useAdminConsole({ token, sessionAdmin, onTokenInvalid });

    await console.loadReports("pending");

    expect(fetchAdminReports).toHaveBeenCalledWith("ops-token", { status: "pending", limit: 100 });
  });

  it("clears admin access state on unauthorized session-admin calls", async () => {
    const token = ref("");
    const sessionAdmin = ref(true);
    const onTokenInvalid = vi.fn();
    fetchAdminReports.mockRejectedValue(new LianApiError("unauthorized", 401));

    const console = useAdminConsole({ token, sessionAdmin, onTokenInvalid });

    await console.loadReports("pending");

    expect(onTokenInvalid).toHaveBeenCalledTimes(1);
  });
});
