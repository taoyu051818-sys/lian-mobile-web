import { expect, request, test, type APIRequestContext } from "@playwright/test";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

type AggregateVerificationItem = {
  verificationId?: string;
  verificationType?: string;
  status?: string;
  publicSummary?: Record<string, unknown>;
  submittedFields?: unknown;
  payload?: unknown;
};

type AggregateVerificationResponse = {
  items?: AggregateVerificationItem[];
  total?: number;
};

type LoginResponse = {
  user?: unknown;
};

type AuthMeResponse = {
  user?: {
    tags?: string[];
    verificationTags?: string[];
    verificationState?: Record<string, { active?: boolean } | undefined>;
  };
};

function env(name: string) {
  return process.env[name]?.trim() || "";
}

function adminHeaders() {
  return { authorization: `Bearer ${env("LIAN_E2E_ADMIN_TOKEN")}` };
}

function transitionPath(verificationType: string, verificationId: string) {
  const encodedId = encodeURIComponent(verificationId);
  if (verificationType === "org-join") return `/api/admin/verifications/org-join/${encodedId}`;
  if (verificationType === "realname") return `/api/admin/verifications/realname/${encodedId}`;
  return `/api/admin/verifications/${verificationType}/${encodedId}`;
}

function expectedTagForType(verificationType: string) {
  if (verificationType === "org-join") return "org_member";
  if (verificationType === "realname") return "realname_verified";
  if (verificationType === "merchant") return "merchant_verified";
  if (verificationType === "runner") return "runner";
  return "";
}

async function login(api: APIRequestContext, username: string, password: string) {
  const response = await api.post("/api/auth/login", {
    data: { login: username, password },
  });
  expect(response.ok(), await response.text()).toBe(true);
  const body = (await response.json()) as LoginResponse;
  expect(body.user).toBeTruthy();
}

test.describe("admin verification aggregate proof @admin", () => {
  test("aggregate queue stays redacted by default", async () => {
    test.skip(!env("LIAN_E2E_ADMIN_TOKEN"), "requires LIAN_E2E_ADMIN_TOKEN");

    const api = await request.newContext({ baseURL: BASE_URL });
    const response = await api.get("/api/admin/verifications?limit=50", {
      headers: adminHeaders(),
    });
    expect(response.ok(), await response.text()).toBe(true);
    const body = (await response.json()) as AggregateVerificationResponse;
    const items = body.items || [];
    expect(Array.isArray(items)).toBe(true);
    expect(typeof body.total === "number" || body.total === undefined).toBe(true);

    for (const item of items) {
      expect(item.submittedFields).toBeUndefined();
      expect(item.payload).toBeUndefined();
      expect(["pending", "approved", "rejected"]).toContain(item.status);
    }

    const realname = items.find((item) => item.verificationType === "realname");
    if (realname?.publicSummary) {
      const idNumber = String(realname.publicSummary.idNumber || "");
      const contact = String(realname.publicSummary.contact || "");
      expect(idNumber.includes("*") || idNumber === "").toBe(true);
      expect(contact.includes("*") || contact === "").toBe(true);
    }

    await api.dispose();
  });

  test("verification approval can flow through backend-owned route and reach auth/me", async () => {
    test.skip(
      !env("LIAN_E2E_ADMIN_TOKEN") ||
        !env("LIAN_E2E_VERIFICATION_REQUEST_ID") ||
        !env("LIAN_E2E_VERIFICATION_TYPE") ||
        !env("LIAN_E2E_VERIFICATION_USERNAME") ||
        !env("LIAN_E2E_VERIFICATION_PASSWORD"),
      "requires admin token plus LIAN_E2E_VERIFICATION_* env",
    );

    const verificationType = env("LIAN_E2E_VERIFICATION_TYPE");
    const verificationId = env("LIAN_E2E_VERIFICATION_REQUEST_ID");
    const expectedTag = env("LIAN_E2E_VERIFICATION_TAG") || expectedTagForType(verificationType);

    const admin = await request.newContext({ baseURL: BASE_URL });
    const user = await request.newContext({ baseURL: BASE_URL });

    const approveResponse = await admin.patch(transitionPath(verificationType, verificationId), {
      headers: adminHeaders(),
      data: {
        status: "approved",
        reviewerNote: `approved by aggregate proof ${Date.now()}`,
      },
    });
    expect(approveResponse.ok(), await approveResponse.text()).toBe(true);

    if (expectedTag) {
      await login(
        user,
        env("LIAN_E2E_VERIFICATION_USERNAME"),
        env("LIAN_E2E_VERIFICATION_PASSWORD"),
      );
      await expect
        .poll(async () => {
          const meResponse = await user.get("/api/auth/me");
          expect(meResponse.ok(), await meResponse.text()).toBe(true);
          const body = (await meResponse.json()) as AuthMeResponse;
          const userBody = body.user || {};
          const flatTags = new Set([
            ...(userBody.tags || []),
            ...(userBody.verificationTags || []),
          ]);
          return (
            flatTags.has(expectedTag) || userBody.verificationState?.[expectedTag]?.active === true
          );
        })
        .toBe(true);
    }

    await admin.dispose();
    await user.dispose();
  });
});
