import { expect, request, test, type APIRequestContext } from "@playwright/test";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

interface FeedResponse {
  items?: Array<{ tid?: number | string; title?: string }>;
}

interface LoginResponse {
  user?: unknown;
}

interface ReportItem {
  reportId?: string;
  targetId?: string | number;
  reason?: string;
  status?: string;
}

interface ReportListResponse {
  items?: ReportItem[];
}

interface ReportPatchResponse {
  report?: ReportItem;
}

interface AuthMeResponse {
  user?: {
    tags?: string[];
    verificationTags?: string[];
    verificationState?: Record<string, { active?: boolean } | undefined>;
  };
}

function env(name: string) {
  return process.env[name]?.trim() || "";
}

function adminHeaders() {
  return { authorization: `Bearer ${env("LIAN_E2E_ADMIN_TOKEN")}` };
}

async function login(api: APIRequestContext, username: string, password: string) {
  const response = await api.post("/api/auth/login", {
    data: { login: username, password },
  });
  expect(response.ok(), await response.text()).toBe(true);
  const body = (await response.json()) as LoginResponse;
  expect(body.user).toBeTruthy();
}

async function firstPublicFeedTid(api: APIRequestContext) {
  const response = await api.get("/api/feed?tab=%E6%AD%A4%E5%88%BB&page=1&limit=12");
  expect(response.ok(), await response.text()).toBe(true);
  const body = (await response.json()) as FeedResponse;
  const item = body.items?.find((candidate) => candidate.tid);
  expect(item?.tid, "feed must expose a reportable post").toBeTruthy();
  return String(item!.tid);
}

async function fetchPendingReport(api: APIRequestContext, tid: string, marker: string) {
  const response = await api.get("/api/admin/reports?status=pending&limit=100", {
    headers: adminHeaders(),
  });
  expect(response.ok(), await response.text()).toBe(true);
  const body = (await response.json()) as ReportListResponse;
  return body.items?.find(
    (item) => String(item.targetId) === tid && String(item.reason || "").includes(marker),
  );
}

async function waitForPendingReport(api: APIRequestContext, tid: string, marker: string) {
  const deadline = Date.now() + 10_000;
  let report = await fetchPendingReport(api, tid, marker);
  while (!report && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    report = await fetchPendingReport(api, tid, marker);
  }
  return report;
}

test.describe("admin moderation proof @admin", () => {
  test("user report appears in admin queue and changes status after review", async () => {
    test.skip(
      !env("LIAN_E2E_USERNAME") || !env("LIAN_E2E_PASSWORD") || !env("LIAN_E2E_ADMIN_TOKEN"),
      "requires LIAN_E2E_USERNAME, LIAN_E2E_PASSWORD, and LIAN_E2E_ADMIN_TOKEN",
    );

    const reporter = await request.newContext({ baseURL: BASE_URL });
    const admin = await request.newContext({ baseURL: BASE_URL });
    await login(reporter, env("LIAN_E2E_USERNAME"), env("LIAN_E2E_PASSWORD"));

    const tid = env("LIAN_E2E_REPORT_TID") || (await firstPublicFeedTid(reporter));
    const marker = `admin-proof-${Date.now()}`;
    const reportResponse = await reporter.post(`/api/posts/${encodeURIComponent(tid)}/report`, {
      data: {
        category: "other",
        reason: `admin proof report ${marker}`,
      },
    });
    expect(reportResponse.ok(), await reportResponse.text()).toBe(true);

    const queuedReport = await waitForPendingReport(admin, tid, marker);
    expect(queuedReport, "reported post should appear in the admin pending queue").toBeTruthy();
    const reportId = queuedReport?.reportId;
    expect(reportId).toBeTruthy();

    const patchResponse = await admin.patch(
      `/api/admin/reports/${encodeURIComponent(String(reportId))}`,
      {
        headers: adminHeaders(),
        data: {
          status: "resolved",
          note: `handled by Playwright admin proof ${marker}`,
        },
      },
    );
    expect(patchResponse.ok(), await patchResponse.text()).toBe(true);
    const patchBody = (await patchResponse.json()) as ReportPatchResponse;
    expect(patchBody.report?.status).toBe("resolved");

    await reporter.dispose();
    await admin.dispose();
  });

  test("approving verification request updates auth/me tags", async () => {
    test.skip(
      !env("LIAN_E2E_ADMIN_TOKEN") ||
        !env("LIAN_E2E_VERIFICATION_REQUEST_ID") ||
        !env("LIAN_E2E_VERIFICATION_USERNAME") ||
        !env("LIAN_E2E_VERIFICATION_PASSWORD") ||
        !env("LIAN_E2E_VERIFICATION_TAG"),
      "requires admin token plus LIAN_E2E_VERIFICATION_* request, user, and tag env",
    );

    const admin = await request.newContext({ baseURL: BASE_URL });
    const user = await request.newContext({ baseURL: BASE_URL });
    const tag = env("LIAN_E2E_VERIFICATION_TAG");

    const approveResponse = await admin.patch(
      `/api/admin/verifications/${encodeURIComponent(env("LIAN_E2E_VERIFICATION_REQUEST_ID"))}`,
      {
        headers: adminHeaders(),
        data: {
          status: "approved",
          note: `approved by Playwright admin proof ${Date.now()}`,
        },
      },
    );
    expect(approveResponse.ok(), await approveResponse.text()).toBe(true);

    await login(user, env("LIAN_E2E_VERIFICATION_USERNAME"), env("LIAN_E2E_VERIFICATION_PASSWORD"));

    await expect
      .poll(async () => {
        const meResponse = await user.get("/api/auth/me");
        expect(meResponse.ok(), await meResponse.text()).toBe(true);
        const body = (await meResponse.json()) as AuthMeResponse;
        const userBody = body.user || {};
        const flatTags = new Set([...(userBody.tags || []), ...(userBody.verificationTags || [])]);
        return flatTags.has(tag) || userBody.verificationState?.[tag]?.active === true;
      })
      .toBe(true);

    await admin.dispose();
    await user.dispose();
  });
});
