// Wire-level proof of the ps#518 / #511 cutover: a single PATCH per
// verification decision, on `/api/admin/verifications/:verificationId`,
// for every channel — no fan-out to the legacy per-channel paths.
//
// Before this cutover, mw routed each decision through one of four
// channel-specific paths (`/org-join/:id`, `/realname/:id`,
// `/merchant/:id`, `/runner/:id`). The aggregate route resolves the
// channel server-side from the id; sending a channel segment as the
// path param now returns 400 (reserved-segment guard).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  patchAdminVerificationRequest,
  type AdminVerificationRequest,
  type AdminVerificationType,
} from "../../src/api/admin.ts";

interface CapturedRequest {
  method: string;
  path: string;
  authorization: string;
  body: unknown;
}

function setupFetchSpy(): {
  calls: CapturedRequest[];
  restore: () => void;
} {
  const calls: CapturedRequest[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = input instanceof URL ? input.toString() : String(input);
    const path = url.replace(/^https?:\/\/[^/]+/, "");
    const headers = new Headers(init.headers || {});
    let parsedBody: unknown = null;
    if (typeof init.body === "string") {
      try {
        parsedBody = JSON.parse(init.body);
      } catch {
        parsedBody = init.body;
      }
    }
    calls.push({
      method: String(init.method || "GET").toUpperCase(),
      path,
      authorization: headers.get("authorization") || "",
      body: parsedBody,
    });
    const responseBody = JSON.stringify({
      ok: true,
      verification: {
        verificationId: "vmr_aggregate_response",
        verificationType: "merchant",
        userId: "u-merchant",
        status: "approved",
        reviewerNote: "ok",
        publicSummary: { merchantName: "校内文印" },
      },
    });
    return new Response(responseBody, {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });

  const original = globalThis.fetch;
  globalThis.fetch = fetchMock as unknown as typeof fetch;

  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

const TOKEN = "test-admin-token";

const FOUR_CHANNEL_FIXTURES: ReadonlyArray<{
  type: AdminVerificationType;
  request: Pick<AdminVerificationRequest, "verificationId" | "verificationType">;
}> = [
  {
    type: "org-join",
    request: { verificationId: "vmr_org_001", verificationType: "org-join" },
  },
  {
    type: "realname",
    request: { verificationId: "vmr_realname_002", verificationType: "realname" },
  },
  {
    type: "merchant",
    request: { verificationId: "vmr_merchant_003", verificationType: "merchant" },
  },
  {
    type: "runner",
    request: { verificationId: "vmr_runner_004", verificationType: "runner" },
  },
];

describe("patchAdminVerificationRequest — aggregate cutover (ps#518 / #511)", () => {
  let spy: ReturnType<typeof setupFetchSpy>;

  beforeEach(() => {
    spy = setupFetchSpy();
  });

  afterEach(() => {
    spy.restore();
    vi.restoreAllMocks();
  });

  it("issues exactly one PATCH per decision regardless of channel", async () => {
    for (const fixture of FOUR_CHANNEL_FIXTURES) {
      await patchAdminVerificationRequest(TOKEN, fixture.request, {
        status: "approved",
        reviewerNote: `aggregate decision for ${fixture.type}`,
      });
    }

    // Four decisions across four channels = four PATCHes total.
    // The legacy fan-out would have produced 4 calls per decision (16 total).
    expect(spy.calls.length).toBe(FOUR_CHANNEL_FIXTURES.length);
    for (const call of spy.calls) {
      expect(call.method).toBe("PATCH");
    }
  });

  it("targets the aggregate path with no channel segment in the URL", async () => {
    for (const fixture of FOUR_CHANNEL_FIXTURES) {
      await patchAdminVerificationRequest(TOKEN, fixture.request, {
        status: "approved",
      });
    }

    const paths = spy.calls.map((call) => call.path);
    expect(paths).toEqual([
      "/api/admin/verifications/vmr_org_001",
      "/api/admin/verifications/vmr_realname_002",
      "/api/admin/verifications/vmr_merchant_003",
      "/api/admin/verifications/vmr_runner_004",
    ]);

    for (const path of paths) {
      expect(path).not.toMatch(
        /\/api\/admin\/verifications\/(?:org-join|realname|merchant|runner)\//,
      );
    }
  });

  it("forwards the discriminated payload (status + reviewerNote) without leaking the channel into the body", async () => {
    await patchAdminVerificationRequest(
      TOKEN,
      { verificationId: "vmr_realname_pii", verificationType: "realname" },
      { status: "rejected", reviewerNote: "信息不一致" },
    );

    expect(spy.calls).toHaveLength(1);
    expect(spy.calls[0].body).toEqual({
      status: "rejected",
      reviewerNote: "信息不一致",
    });
    // Backend owns publicSummary derivation; the client must not send it.
    const body = spy.calls[0].body as Record<string, unknown>;
    expect(body).not.toHaveProperty("publicSummary");
    expect(body).not.toHaveProperty("verificationType");
  });

  it("attaches the admin Bearer token on every aggregate PATCH", async () => {
    for (const fixture of FOUR_CHANNEL_FIXTURES) {
      await patchAdminVerificationRequest(TOKEN, fixture.request, { status: "approved" });
    }

    for (const call of spy.calls) {
      expect(call.authorization).toBe(`Bearer ${TOKEN}`);
    }
  });

  it("URL-encodes verificationIds with reserved characters", async () => {
    await patchAdminVerificationRequest(
      TOKEN,
      { verificationId: "vmr/with space?weird", verificationType: "merchant" },
      { status: "approved" },
    );

    expect(spy.calls).toHaveLength(1);
    expect(spy.calls[0].path).toBe("/api/admin/verifications/vmr%2Fwith%20space%3Fweird");
  });
});
