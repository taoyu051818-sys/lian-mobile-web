import { afterEach, describe, expect, it, vi } from "vitest";
import { ref, type Ref } from "vue";

import { LianApiError } from "../../src/api/http";
import { useAdminConsole } from "../../src/features/admin/useAdminConsole";
import type { AdminReport } from "../../src/types/admin";
import type { AdminVerificationRequest } from "../../src/api/admin";

const adminApi = vi.hoisted(() => ({
  fetchAdminReports: vi.fn(),
  fetchAdminAuditLog: vi.fn(),
  fetchAdminVerificationRequests: vi.fn(),
  fetchAdminVerificationDetail: vi.fn(),
  patchAdminReport: vi.fn(),
  patchAdminUserStatus: vi.fn(),
  patchAdminVerificationRequest: vi.fn(),
  postAdminPostAction: vi.fn(),
}));

const authLinkApi = vi.hoisted(() => ({
  createAdminAuthLink: vi.fn(),
  fetchAdminAuthLinks: vi.fn(),
  revokeAdminAuthLink: vi.fn(),
}));

vi.mock("../../src/api/admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/api/admin")>();
  return { ...actual, ...adminApi };
});

vi.mock("../../src/api/adminAuthLink", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/api/adminAuthLink")>();
  return { ...actual, ...authLinkApi };
});

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const report = {
  reportId: "report-1",
  status: "pending",
  targetType: "post",
  targetId: "post-1",
} as AdminReport;

const updatedReport = { ...report, status: "resolved" } as AdminReport;

const verification = {
  verificationId: "verification-1",
  verificationType: "realname",
  userId: "user-1",
  status: "pending",
} as AdminVerificationRequest;

const auditEvent = { id: "audit-1", action: "admin.test" };
const authLink = { token: "link-1", url: "https://lian.invalid/link-1" };
const verificationDetail = {
  ...verification,
  realName: "safe detail",
};

type AdminConsole = ReturnType<typeof useAdminConsole> & { dispose?: () => void };

interface ConsoleHarness {
  token: Ref<string>;
  lane: Ref<string>;
  authEpoch: Ref<number>;
  onTokenInvalid: ReturnType<typeof vi.fn>;
  console: AdminConsole;
}

function makeConsole(
  options: { token?: string; lane?: string; epoch?: number } = {},
): ConsoleHarness {
  const token = ref(options.token ?? "ops-token");
  const lane = ref(options.lane ?? "ops");
  const authEpoch = ref(options.epoch ?? 1);
  const onTokenInvalid = vi.fn();
  // Collection control for the pre-LA2b runtime: its removed sessionAdmin
  // parameter stays false so RED reaches each settlement assertion instead
  // of collapsing into an unrelated undefined-property rejection.
  const sessionAdmin = ref(false);
  const console = useAdminConsole({
    token,
    lane,
    authEpoch,
    onTokenInvalid,
    sessionAdmin,
  } as never) as AdminConsole;
  return { token, lane, authEpoch, onTokenInvalid, console };
}

function installHappyApis() {
  adminApi.fetchAdminReports.mockResolvedValue({ items: [report], total: 1 });
  adminApi.fetchAdminAuditLog.mockResolvedValue({ items: [auditEvent], total: 1 });
  adminApi.fetchAdminVerificationRequests.mockResolvedValue({ items: [verification], total: 1 });
  adminApi.fetchAdminVerificationDetail.mockResolvedValue(verificationDetail);
  adminApi.patchAdminReport.mockResolvedValue(updatedReport);
  adminApi.patchAdminUserStatus.mockResolvedValue({ userId: "user-1", status: "active" });
  adminApi.patchAdminVerificationRequest.mockResolvedValue(verificationDetail);
  adminApi.postAdminPostAction.mockResolvedValue(undefined);
  authLinkApi.createAdminAuthLink.mockResolvedValue(authLink);
  authLinkApi.fetchAdminAuthLinks.mockResolvedValue({ items: [authLink] });
  authLinkApi.revokeAdminAuthLink.mockResolvedValue(undefined);
}

async function invokeEveryPublicAsync(console: AdminConsole) {
  return Promise.all([
    console.loadReports("pending"),
    console.loadAuditLog(),
    console.loadVerificationRequests("pending"),
    console.loadAuthLinks(),
    console.transitionReport("report-1", { status: "resolved" }),
    console.applyPostAction(1, "hide"),
    console.applyUserStatus("user-1", { status: "active" }),
    console.reviewVerificationRequest(verification, { status: "approved" }),
    console.revealVerificationRequest(verification),
    console.createAuthLink({ ttlSeconds: 3_600 }),
    console.revokeAuthLink("link-1"),
  ]);
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

function expectNoConsoleError(console: AdminConsole) {
  expect([
    console.reportsError.value,
    console.auditError.value,
    console.verificationError.value,
    console.verificationRevealError.value,
    console.authLinksError.value,
    console.authLinkCreateError.value,
    console.actionError.value,
  ]).toEqual(["", "", "", "", "", "", ""]);
}

function consoleEphemeralSnapshot(console: AdminConsole) {
  return {
    reports: [...console.reports.value],
    reportsTotal: console.reportsTotal.value,
    auditEvents: [...console.auditEvents.value],
    verificationRequests: [...console.verificationRequests.value],
    verificationTotal: console.verificationTotal.value,
    revealedVerificationDetails: { ...console.revealedVerificationDetails.value },
    authLinks: [...console.authLinks.value],
  };
}

const EMPTY_CONSOLE_EPHEMERAL_STATE = {
  reports: [],
  reportsTotal: 0,
  auditEvents: [],
  verificationRequests: [],
  verificationTotal: 0,
  revealedVerificationDetails: {},
  authLinks: [],
};

afterEach(() => {
  vi.resetAllMocks();
});

describe("useAdminConsole exact ops authorization", () => {
  it.each([
    ["probing", "ops-token"],
    ["session-merchants", "ops-token"],
    ["gate", "ops-token"],
    ["probe-error", "ops-token"],
    ["disposed", "ops-token"],
    ["ops", ""],
    ["ops", "   "],
  ])("blocks every public load/action for lane=%s token=%j", async (lane, token) => {
    installHappyApis();
    const harness = makeConsole({ lane, token });

    await invokeEveryPublicAsync(harness.console);

    for (const api of [...Object.values(adminApi), ...Object.values(authLinkApi)]) {
      expect(api).not.toHaveBeenCalled();
    }
    expect(harness.onTokenInvalid).not.toHaveBeenCalled();
  });

  it("uses the same explicit Bearer token for every public ops load/action", async () => {
    installHappyApis();
    const { console } = makeConsole({ token: "exact-ops-token", lane: "ops" });

    await invokeEveryPublicAsync(console);

    for (const api of Object.values(adminApi)) expect(api).toHaveBeenCalled();
    for (const api of Object.values(authLinkApi)) expect(api).toHaveBeenCalled();
    for (const api of [...Object.values(adminApi), ...Object.values(authLinkApi)]) {
      for (const call of api.mock.calls) expect(call[0]).toBe("exact-ops-token");
    }
  });

  it.each([401, 403])(
    "clears account A collections on current %i before account B ordinary load failure",
    async (status) => {
      installHappyApis();
      const harness = makeConsole({ token: "account-a-token", lane: "ops", epoch: 10 });
      await Promise.all([
        harness.console.loadReports("pending"),
        harness.console.loadAuditLog(),
        harness.console.loadVerificationRequests("pending"),
        harness.console.loadAuthLinks(),
      ]);
      await harness.console.revealVerificationRequest(verification);
      expect(consoleEphemeralSnapshot(harness.console)).toEqual({
        reports: [report],
        reportsTotal: 1,
        auditEvents: [auditEvent],
        verificationRequests: [verification],
        verificationTotal: 1,
        revealedVerificationDetails: {
          [verification.verificationId]: verificationDetail,
        },
        authLinks: [authLink],
      });

      harness.onTokenInvalid.mockImplementationOnce(() => {
        harness.authEpoch.value += 1;
        harness.token.value = "";
        harness.lane.value = "gate";
      });
      adminApi.postAdminPostAction.mockRejectedValueOnce(
        new LianApiError("raw account A authorization failure", status),
      );
      await harness.console.applyPostAction(2, "hide");
      const afterGate = consoleEphemeralSnapshot(harness.console);

      harness.token.value = "account-b-token";
      harness.authEpoch.value += 1;
      harness.lane.value = "ops";
      adminApi.fetchAdminReports.mockRejectedValueOnce(
        new Error("raw account B ordinary failure must not reveal account A"),
      );
      await harness.console.loadReports("pending");

      expect(harness.onTokenInvalid).toHaveBeenCalledTimes(1);
      expect(afterGate).toEqual(EMPTY_CONSOLE_EPHEMERAL_STATE);
      expect(consoleEphemeralSnapshot(harness.console)).toEqual(EMPTY_CONSOLE_EPHEMERAL_STATE);
    },
  );
});

interface OperationCase<T = unknown> {
  name: string;
  mock: ReturnType<typeof vi.fn>;
  nestedReloadMock?: ReturnType<typeof vi.fn>;
  success: T;
  invoke(console: AdminConsole): Promise<unknown>;
  assertUncommitted(console: AdminConsole): void;
  assertCommitted(console: AdminConsole): void;
}

function operationCases(): OperationCase[] {
  return [
    {
      name: "loadReports",
      mock: adminApi.fetchAdminReports,
      success: { items: [report], total: 1 },
      invoke: (value) => value.loadReports("pending"),
      assertUncommitted: (value) => expect(value.reports.value).toEqual([]),
      assertCommitted: (value) => expect(value.reports.value).toEqual([report]),
    },
    {
      name: "loadAuditLog",
      mock: adminApi.fetchAdminAuditLog,
      success: { items: [auditEvent], total: 1 },
      invoke: (value) => value.loadAuditLog(),
      assertUncommitted: (value) => expect(value.auditEvents.value).toEqual([]),
      assertCommitted: (value) => expect(value.auditEvents.value).toEqual([auditEvent]),
    },
    {
      name: "loadVerificationRequests",
      mock: adminApi.fetchAdminVerificationRequests,
      success: { items: [verification], total: 1 },
      invoke: (value) => value.loadVerificationRequests("pending"),
      assertUncommitted: (value) => expect(value.verificationRequests.value).toEqual([]),
      assertCommitted: (value) => expect(value.verificationRequests.value).toEqual([verification]),
    },
    {
      name: "loadAuthLinks",
      mock: authLinkApi.fetchAdminAuthLinks,
      success: { items: [authLink] },
      invoke: (value) => value.loadAuthLinks(),
      assertUncommitted: (value) => expect(value.authLinks.value).toEqual([]),
      assertCommitted: (value) => expect(value.authLinks.value).toEqual([authLink]),
    },
    {
      name: "transitionReport",
      mock: adminApi.patchAdminReport,
      success: updatedReport,
      invoke: (value) => value.transitionReport("report-1", { status: "resolved" }),
      assertUncommitted: (value) => expect(value.actionMessage.value).toBe(""),
      assertCommitted: (value) => expect(value.actionMessage.value).not.toBe(""),
    },
    {
      name: "applyPostAction",
      mock: adminApi.postAdminPostAction,
      success: undefined,
      invoke: (value) => value.applyPostAction(1, "hide"),
      assertUncommitted: (value) => expect(value.actionMessage.value).toBe(""),
      assertCommitted: (value) => expect(value.actionMessage.value).not.toBe(""),
    },
    {
      name: "applyUserStatus",
      mock: adminApi.patchAdminUserStatus,
      success: { userId: "user-1", status: "active" },
      invoke: (value) => value.applyUserStatus("user-1", { status: "active" }),
      assertUncommitted: (value) => expect(value.actionMessage.value).toBe(""),
      assertCommitted: (value) => expect(value.actionMessage.value).not.toBe(""),
    },
    {
      name: "reviewVerificationRequest",
      mock: adminApi.patchAdminVerificationRequest,
      nestedReloadMock: adminApi.fetchAdminVerificationRequests,
      success: verificationDetail,
      invoke: (value) => value.reviewVerificationRequest(verification, { status: "approved" }),
      assertUncommitted: (value) => expect(value.actionMessage.value).toBe(""),
      assertCommitted: (value) => expect(value.actionMessage.value).not.toBe(""),
    },
    {
      name: "revealVerificationRequest",
      mock: adminApi.fetchAdminVerificationDetail,
      success: verificationDetail,
      invoke: (value) => value.revealVerificationRequest(verification),
      assertUncommitted: (value) => expect(value.revealedVerificationDetails.value).toEqual({}),
      assertCommitted: (value) =>
        expect(value.revealedVerificationDetails.value).toEqual({
          [verification.verificationId]: verificationDetail,
        }),
    },
    {
      name: "createAuthLink",
      mock: authLinkApi.createAdminAuthLink,
      nestedReloadMock: authLinkApi.fetchAdminAuthLinks,
      success: authLink,
      invoke: (value) => value.createAuthLink({ ttlSeconds: 3_600 }),
      assertUncommitted: (value) => expect(value.actionMessage.value).toBe(""),
      assertCommitted: (value) => expect(value.actionMessage.value).not.toBe(""),
    },
    {
      name: "revokeAuthLink",
      mock: authLinkApi.revokeAdminAuthLink,
      nestedReloadMock: authLinkApi.fetchAdminAuthLinks,
      success: undefined,
      invoke: (value) => value.revokeAuthLink("link-1"),
      assertUncommitted: (value) => expect(value.actionMessage.value).toBe(""),
      assertCommitted: (value) => expect(value.actionMessage.value).not.toBe(""),
    },
  ];
}

describe("useAdminConsole logical lane/epoch/sequence ownership", () => {
  for (const operation of operationCases()) {
    it(`${operation.name} rejects stale success after lane and auth epoch invalidation`, async () => {
      installHappyApis();
      const pending = deferred<unknown>();
      operation.mock.mockReturnValueOnce(pending.promise);
      const harness = makeConsole();
      const run = operation.invoke(harness.console);

      harness.lane.value = "gate";
      harness.authEpoch.value += 1;
      pending.resolve(operation.success);
      await run;

      operation.assertUncommitted(harness.console);
      expect(harness.onTokenInvalid).not.toHaveBeenCalled();
    });

    it(`${operation.name} rejects stale 401 and does not clear the new owner`, async () => {
      installHappyApis();
      const pending = deferred<unknown>();
      operation.mock.mockReturnValueOnce(pending.promise);
      const harness = makeConsole();
      const run = operation.invoke(harness.console);

      harness.lane.value = "gate";
      harness.authEpoch.value += 1;
      pending.reject(new LianApiError("stale unauthorized", 401));
      await run;

      operation.assertUncommitted(harness.console);
      expect(harness.onTokenInvalid).not.toHaveBeenCalled();
      expectNoConsoleError(harness.console);
    });

    it(`${operation.name} rejects a stale ordinary failure without rendering raw error state`, async () => {
      installHappyApis();
      const pending = deferred<unknown>();
      operation.mock.mockReturnValueOnce(pending.promise);
      const harness = makeConsole();
      const run = operation.invoke(harness.console);

      harness.lane.value = "gate";
      harness.authEpoch.value += 1;
      pending.reject(new Error("RAW ordinary stale failure with sentinel"));
      await run;

      operation.assertUncommitted(harness.console);
      expect(harness.onTokenInvalid).not.toHaveBeenCalled();
      expectNoConsoleError(harness.console);
    });

    it(`${operation.name} lets only the latest same-operation sequence commit success`, async () => {
      installHappyApis();
      const first = deferred<unknown>();
      const second = deferred<unknown>();
      operation.mock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
      const harness = makeConsole();
      const firstRun = operation.invoke(harness.console);
      const secondRun = operation.invoke(harness.console);

      first.resolve(operation.success);
      await firstRun;
      operation.assertUncommitted(harness.console);
      expect(harness.onTokenInvalid).not.toHaveBeenCalled();
      if (operation.nestedReloadMock) {
        expect(operation.nestedReloadMock).not.toHaveBeenCalled();
      }

      second.resolve(operation.success);
      await secondRun;
      operation.assertCommitted(harness.console);
      expect(harness.onTokenInvalid).not.toHaveBeenCalled();
      if (operation.nestedReloadMock) {
        expect(operation.nestedReloadMock).toHaveBeenCalledTimes(1);
      }
    });

    it(`${operation.name} ignores an older same-operation 401 after a newer sequence starts`, async () => {
      installHappyApis();
      const first = deferred<unknown>();
      const second = deferred<unknown>();
      operation.mock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
      const harness = makeConsole();
      const firstRun = operation.invoke(harness.console);
      const secondRun = operation.invoke(harness.console);

      first.reject(new LianApiError("stale unauthorized", 401));
      await firstRun;
      expect(harness.onTokenInvalid).not.toHaveBeenCalled();
      expectNoConsoleError(harness.console);

      second.resolve(operation.success);
      await secondRun;
      operation.assertCommitted(harness.console);
      expect(harness.onTokenInvalid).not.toHaveBeenCalled();
    });

    it.each([401, 403])(
      `${operation.name} sends a current ops %i through one authorization-loss transition`,
      async (status) => {
        installHappyApis();
        operation.mock.mockRejectedValueOnce(new LianApiError("raw unauthorized", status));
        const harness = makeConsole();

        await operation.invoke(harness.console);

        operation.assertUncommitted(harness.console);
        expect(harness.onTokenInvalid).toHaveBeenCalledTimes(1);
        expectNoConsoleError(harness.console);
      },
    );
  }

  for (const operation of operationCases()) {
    it(`${operation.name} registers its owner before transport can synchronously reenter`, async () => {
      installHappyApis();
      const staleOuter = deferred<unknown>();
      const currentInner = deferred<unknown>();
      const harness = makeConsole();
      let innerRun!: Promise<unknown>;
      operation.mock
        .mockImplementationOnce(() => {
          innerRun = operation.invoke(harness.console);
          return staleOuter.promise;
        })
        .mockReturnValueOnce(currentInner.promise);

      const outerRun = operation.invoke(harness.console);
      expect(operation.mock).toHaveBeenCalledTimes(2);

      staleOuter.resolve(operation.success);
      await outerRun;
      operation.assertUncommitted(harness.console);
      expect(harness.onTokenInvalid).not.toHaveBeenCalled();
      if (operation.nestedReloadMock) {
        expect(operation.nestedReloadMock).not.toHaveBeenCalled();
      }

      currentInner.resolve(operation.success);
      await innerRun;
      operation.assertCommitted(harness.console);
      expect(harness.onTokenInvalid).not.toHaveBeenCalled();
      if (operation.nestedReloadMock) {
        expect(operation.nestedReloadMock).toHaveBeenCalledTimes(1);
      }
    });
  }

  it("rejects a synchronous nested reload after review ownership is invalidated", async () => {
    installHappyApis();
    const outer = deferred<unknown>();
    adminApi.patchAdminVerificationRequest.mockReturnValueOnce(outer.promise);
    const harness = makeConsole();
    const run = harness.console.reviewVerificationRequest(verification, { status: "approved" });

    harness.lane.value = "gate";
    harness.authEpoch.value += 1;
    outer.resolve(verificationDetail);
    await run;

    expect(adminApi.fetchAdminVerificationRequests).not.toHaveBeenCalled();
    expect(harness.console.actionMessage.value).toBe("");
  });

  it("review B invalidates review A's already-started nested reload before B transport settles", async () => {
    installHappyApis();
    const outerA = deferred<unknown>();
    const outerB = deferred<unknown>();
    const nestedA = deferred<{ items: AdminVerificationRequest[]; total: number }>();
    const nestedB = deferred<{ items: AdminVerificationRequest[]; total: number }>();
    const requestA = { ...verification, verificationId: "verification-a" };
    const requestB = { ...verification, verificationId: "verification-b" };
    adminApi.patchAdminVerificationRequest
      .mockReturnValueOnce(outerA.promise)
      .mockReturnValueOnce(outerB.promise);
    adminApi.fetchAdminVerificationRequests
      .mockReturnValueOnce(nestedA.promise)
      .mockReturnValueOnce(nestedB.promise);
    const harness = makeConsole();

    const runA = harness.console.reviewVerificationRequest(requestA, { status: "approved" });
    outerA.resolve({ ...verificationDetail, verificationId: requestA.verificationId });
    await flush();
    expect(adminApi.fetchAdminVerificationRequests).toHaveBeenCalledTimes(1);

    const runB = harness.console.reviewVerificationRequest(requestB, { status: "approved" });
    nestedA.resolve({ items: [requestA], total: 1 });
    await runA;
    expect(harness.console.verificationRequests.value).toEqual([]);
    expect(harness.console.actionMessage.value).toBe("");

    outerB.resolve({ ...verificationDetail, verificationId: requestB.verificationId });
    await flush();
    expect(adminApi.fetchAdminVerificationRequests).toHaveBeenCalledTimes(2);
    nestedB.resolve({ items: [requestB], total: 1 });
    await runB;
    expect(harness.console.verificationRequests.value).toEqual([requestB]);
    expect(harness.console.actionMessage.value).not.toBe("");
  });

  it("create B invalidates create A's nested auth-link reload and stale finally", async () => {
    installHappyApis();
    const outerA = deferred<unknown>();
    const outerB = deferred<unknown>();
    const nestedA = deferred<{ items: Array<typeof authLink> }>();
    const nestedB = deferred<{ items: Array<typeof authLink> }>();
    const linkA = { ...authLink, token: "link-a", url: "https://lian.invalid/link-a" };
    const linkB = { ...authLink, token: "link-b", url: "https://lian.invalid/link-b" };
    authLinkApi.createAdminAuthLink
      .mockReturnValueOnce(outerA.promise)
      .mockReturnValueOnce(outerB.promise);
    authLinkApi.fetchAdminAuthLinks
      .mockReturnValueOnce(nestedA.promise)
      .mockReturnValueOnce(nestedB.promise);
    const harness = makeConsole();

    const runA = harness.console.createAuthLink({ ttlSeconds: 3_600 });
    outerA.resolve(linkA);
    await flush();
    expect(authLinkApi.fetchAdminAuthLinks).toHaveBeenCalledTimes(1);

    const runB = harness.console.createAuthLink({ ttlSeconds: 7_200 });
    nestedA.resolve({ items: [linkA] });
    await runA;
    expect(harness.console.authLinks.value).toEqual([]);
    expect(harness.console.actionMessage.value).toBe("");
    expect(harness.console.authLinkCreating.value).toBe(true);

    outerB.resolve(linkB);
    await flush();
    expect(authLinkApi.fetchAdminAuthLinks).toHaveBeenCalledTimes(2);
    nestedB.resolve({ items: [linkB] });
    await runB;
    expect(harness.console.authLinks.value).toEqual([linkB]);
    expect(harness.console.actionMessage.value).not.toBe("");
    expect(harness.console.authLinkCreating.value).toBe(false);
  });

  it("revoke B invalidates revoke A's already-started nested auth-link reload", async () => {
    installHappyApis();
    const outerA = deferred<unknown>();
    const outerB = deferred<unknown>();
    const nestedA = deferred<{ items: Array<typeof authLink> }>();
    const nestedB = deferred<{ items: Array<typeof authLink> }>();
    const linkA = { ...authLink, token: "link-a", url: "https://lian.invalid/link-a" };
    const linkB = { ...authLink, token: "link-b", url: "https://lian.invalid/link-b" };
    authLinkApi.revokeAdminAuthLink
      .mockReturnValueOnce(outerA.promise)
      .mockReturnValueOnce(outerB.promise);
    authLinkApi.fetchAdminAuthLinks
      .mockReturnValueOnce(nestedA.promise)
      .mockReturnValueOnce(nestedB.promise);
    const harness = makeConsole();

    const runA = harness.console.revokeAuthLink("link-a");
    outerA.resolve(undefined);
    await flush();
    expect(authLinkApi.fetchAdminAuthLinks).toHaveBeenCalledTimes(1);

    const runB = harness.console.revokeAuthLink("link-b");
    nestedA.resolve({ items: [linkA] });
    await runA;
    expect(harness.console.authLinks.value).toEqual([]);
    expect(harness.console.actionMessage.value).toBe("");

    outerB.resolve(undefined);
    await flush();
    expect(authLinkApi.fetchAdminAuthLinks).toHaveBeenCalledTimes(2);
    nestedB.resolve({ items: [linkB] });
    await runB;
    expect(harness.console.authLinks.value).toEqual([linkB]);
    expect(harness.console.actionMessage.value).not.toBe("");
  });

  it.each(["create", "revoke"] as const)(
    "rejects %s-auth-link nested reload settlement after auth epoch changes",
    async (kind) => {
      installHappyApis();
      const nested = deferred<{ items: unknown[] }>();
      authLinkApi.fetchAdminAuthLinks.mockReturnValueOnce(nested.promise);
      const harness = makeConsole();
      const run =
        kind === "create"
          ? harness.console.createAuthLink({ ttlSeconds: 3_600 })
          : harness.console.revokeAuthLink("link-1");
      await flush();
      expect(authLinkApi.fetchAdminAuthLinks).toHaveBeenCalledTimes(1);

      harness.lane.value = "gate";
      harness.authEpoch.value += 1;
      nested.resolve({ items: [authLink] });
      await run;

      expect(harness.console.authLinks.value).toEqual([]);
      expect(harness.console.actionMessage.value).toBe("");
    },
  );

  it.each(["review", "create", "revoke"] as const)(
    "a stale %s nested-reload 401 cannot invalidate a newer account",
    async (kind) => {
      installHappyApis();
      const nested = deferred<{ items: unknown[]; total?: number }>();
      if (kind === "review") {
        adminApi.fetchAdminVerificationRequests.mockReturnValueOnce(nested.promise);
      } else {
        authLinkApi.fetchAdminAuthLinks.mockReturnValueOnce(nested.promise);
      }
      const harness = makeConsole();
      const run =
        kind === "review"
          ? harness.console.reviewVerificationRequest(verification, { status: "approved" })
          : kind === "create"
            ? harness.console.createAuthLink({ ttlSeconds: 3_600 })
            : harness.console.revokeAuthLink("link-1");
      await flush();

      harness.lane.value = "gate";
      harness.authEpoch.value += 1;
      nested.reject(new LianApiError("stale unauthorized", 401));
      await run;

      expect(harness.onTokenInvalid).not.toHaveBeenCalled();
      expect(harness.console.actionMessage.value).toBe("");
      expect(harness.console.actionError.value).toBe("");
    },
  );
});

describe("useAdminConsole overlapping finally ownership", () => {
  interface FinalizerCase {
    name: string;
    mock: ReturnType<typeof vi.fn>;
    success: unknown;
    invoke(console: AdminConsole): Promise<unknown>;
    readOwner(console: AdminConsole): unknown;
    expectedOwner: unknown;
  }

  function finalizerCases(): FinalizerCase[] {
    return [
      {
        name: "reports load",
        mock: adminApi.fetchAdminReports,
        success: { items: [report], total: 1 },
        invoke: (value) => value.loadReports("pending"),
        readOwner: (value) => value.reportsLoading.value,
        expectedOwner: true,
      },
      {
        name: "audit load",
        mock: adminApi.fetchAdminAuditLog,
        success: { items: [auditEvent], total: 1 },
        invoke: (value) => value.loadAuditLog(),
        readOwner: (value) => value.auditLoading.value,
        expectedOwner: true,
      },
      {
        name: "verification load",
        mock: adminApi.fetchAdminVerificationRequests,
        success: { items: [verification], total: 1 },
        invoke: (value) => value.loadVerificationRequests("pending"),
        readOwner: (value) => value.verificationLoading.value,
        expectedOwner: true,
      },
      {
        name: "auth-link load",
        mock: authLinkApi.fetchAdminAuthLinks,
        success: { items: [authLink] },
        invoke: (value) => value.loadAuthLinks(),
        readOwner: (value) => value.authLinksLoading.value,
        expectedOwner: true,
      },
      {
        name: "verification reveal",
        mock: adminApi.fetchAdminVerificationDetail,
        success: verificationDetail,
        invoke: (value) => value.revealVerificationRequest(verification),
        readOwner: (value) => value.revealingVerificationId.value,
        expectedOwner: verification.verificationId,
      },
      {
        name: "auth-link create",
        mock: authLinkApi.createAdminAuthLink,
        success: authLink,
        invoke: (value) => value.createAuthLink({ ttlSeconds: 3_600 }),
        readOwner: (value) => value.authLinkCreating.value,
        expectedOwner: true,
      },
    ];
  }

  interface FinalizerInvalidator {
    name: string;
    invalidate(harness: ConsoleHarness): Promise<void> | void;
  }

  function finalizerInvalidators(): FinalizerInvalidator[] {
    return [
      {
        name: "lane change",
        invalidate: (harness) => {
          harness.lane.value = "gate";
        },
      },
      {
        name: "auth epoch change",
        invalidate: (harness) => {
          harness.authEpoch.value += 1;
        },
      },
      {
        name: "token replacement",
        invalidate: (harness) => {
          harness.token.value = "replacement-ops-token";
        },
      },
      {
        name: "authorization-version change",
        invalidate: async (harness) => {
          adminApi.postAdminPostAction.mockRejectedValueOnce(
            new LianApiError("current authorization lost", 401),
          );
          await harness.console.applyPostAction(2, "hide");
          expect(harness.onTokenInvalid).toHaveBeenCalledTimes(1);
        },
      },
    ];
  }

  for (const operation of finalizerCases()) {
    for (const invalidator of finalizerInvalidators()) {
      it(`${operation.name} stale finally cannot write after ${invalidator.name}`, async () => {
        installHappyApis();
        const pending = deferred<unknown>();
        operation.mock.mockReturnValueOnce(pending.promise);
        const harness = makeConsole();
        const run = operation.invoke(harness.console);

        expect(operation.readOwner(harness.console)).toBe(operation.expectedOwner);
        await invalidator.invalidate(harness);
        const ownerAfterInvalidation = operation.readOwner(harness.console);
        if (invalidator.name !== "authorization-version change") {
          expect(ownerAfterInvalidation).toBe(operation.expectedOwner);
        }

        pending.resolve(operation.success);
        await run;

        expect(operation.readOwner(harness.console)).toBe(ownerAfterInvalidation);
      });
    }
  }

  it.each(["review", "create", "revoke"] as const)(
    "a %s nested reload whose parent is superseded cannot clear loading ownership",
    async (kind) => {
      installHappyApis();
      const nestedA = deferred<unknown>();
      const nestedB = deferred<unknown>();
      const successorOuter = deferred<unknown>();
      let runA: Promise<unknown>;
      let runB: Promise<unknown>;
      let readLoading: () => boolean;
      let settleNestedA: () => void;
      let settleNestedB: () => void;
      let settleSuccessorOuter: () => void;
      let nestedReloadMock: ReturnType<typeof vi.fn>;
      const harness = makeConsole();

      if (kind === "review") {
        adminApi.patchAdminVerificationRequest
          .mockResolvedValueOnce(verificationDetail)
          .mockReturnValueOnce(successorOuter.promise);
        adminApi.fetchAdminVerificationRequests
          .mockReturnValueOnce(nestedA.promise)
          .mockReturnValueOnce(nestedB.promise);
        const invoke = () =>
          harness.console.reviewVerificationRequest(verification, { status: "approved" });
        runA = invoke();
        await flush();
        expect(adminApi.fetchAdminVerificationRequests).toHaveBeenCalledTimes(1);
        runB = invoke();
        readLoading = () => harness.console.verificationLoading.value;
        settleNestedA = () => nestedA.resolve({ items: [verification], total: 1 });
        settleNestedB = () => nestedB.resolve({ items: [verification], total: 1 });
        settleSuccessorOuter = () => successorOuter.resolve(verificationDetail);
        nestedReloadMock = adminApi.fetchAdminVerificationRequests;
      } else {
        authLinkApi.fetchAdminAuthLinks
          .mockReturnValueOnce(nestedA.promise)
          .mockReturnValueOnce(nestedB.promise);
        if (kind === "create") {
          authLinkApi.createAdminAuthLink
            .mockResolvedValueOnce(authLink)
            .mockReturnValueOnce(successorOuter.promise);
          const invoke = () => harness.console.createAuthLink({ ttlSeconds: 3_600 });
          runA = invoke();
          await flush();
          expect(authLinkApi.fetchAdminAuthLinks).toHaveBeenCalledTimes(1);
          runB = invoke();
          settleSuccessorOuter = () => successorOuter.resolve(authLink);
        } else {
          authLinkApi.revokeAdminAuthLink
            .mockResolvedValueOnce(undefined)
            .mockReturnValueOnce(successorOuter.promise);
          const invoke = () => harness.console.revokeAuthLink("link-1");
          runA = invoke();
          await flush();
          expect(authLinkApi.fetchAdminAuthLinks).toHaveBeenCalledTimes(1);
          runB = invoke();
          settleSuccessorOuter = () => successorOuter.resolve(undefined);
        }
        readLoading = () => harness.console.authLinksLoading.value;
        settleNestedA = () => nestedA.resolve({ items: [authLink] });
        settleNestedB = () => nestedB.resolve({ items: [authLink] });
        nestedReloadMock = authLinkApi.fetchAdminAuthLinks;
      }

      expect(nestedReloadMock).toHaveBeenCalledTimes(1);
      expect(readLoading()).toBe(true);
      settleNestedA();
      await runA;
      const loadingAfterStaleParent = readLoading();

      settleSuccessorOuter();
      await flush();
      expect(nestedReloadMock).toHaveBeenCalledTimes(2);
      const loadingDuringSuccessorChild = readLoading();
      settleNestedB();
      await runB;
      const loadingAfterSuccessorChild = readLoading();

      expect(loadingAfterStaleParent).toBe(true);
      expect(loadingDuringSuccessorChild).toBe(true);
      expect(loadingAfterSuccessorChild).toBe(false);
    },
  );

  it.each([
    [
      "reports",
      adminApi.fetchAdminReports,
      "loadReports",
      "reportsLoading",
      { items: [report], total: 1 },
    ],
    [
      "audit",
      adminApi.fetchAdminAuditLog,
      "loadAuditLog",
      "auditLoading",
      { items: [auditEvent], total: 1 },
    ],
    [
      "verifications",
      adminApi.fetchAdminVerificationRequests,
      "loadVerificationRequests",
      "verificationLoading",
      { items: [verification], total: 1 },
    ],
    [
      "auth links",
      authLinkApi.fetchAdminAuthLinks,
      "loadAuthLinks",
      "authLinksLoading",
      { items: [authLink] },
    ],
  ] as const)(
    "stale %s finally cannot clear the current request loading owner",
    async (_name, api, method, loadingKey, success) => {
      installHappyApis();
      const first = deferred<unknown>();
      const second = deferred<unknown>();
      api.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
      const harness = makeConsole();
      const call = harness.console[method] as () => Promise<void>;
      const firstRun = call();
      const secondRun = call();

      first.resolve(success);
      await firstRun;
      expect((harness.console[loadingKey] as Ref<boolean>).value).toBe(true);

      second.resolve(success);
      await secondRun;
      expect((harness.console[loadingKey] as Ref<boolean>).value).toBe(false);
    },
  );

  it("stale reveal finally cannot clear the current revealing id", async () => {
    installHappyApis();
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    adminApi.fetchAdminVerificationDetail
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const harness = makeConsole();
    const firstRequest = { ...verification, verificationId: "verification-1" };
    const secondRequest = { ...verification, verificationId: "verification-2" };
    const firstRun = harness.console.revealVerificationRequest(firstRequest);
    const secondRun = harness.console.revealVerificationRequest(secondRequest);

    first.resolve({ ...verificationDetail, verificationId: "verification-1" });
    await firstRun;
    expect(harness.console.revealingVerificationId.value).toBe("verification-2");

    second.resolve({ ...verificationDetail, verificationId: "verification-2" });
    await secondRun;
    expect(harness.console.revealingVerificationId.value).toBe("");
  });

  it("stale create finally cannot clear the current create owner", async () => {
    installHappyApis();
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    authLinkApi.createAdminAuthLink
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const harness = makeConsole();
    const firstRun = harness.console.createAuthLink({ ttlSeconds: 3_600 });
    const secondRun = harness.console.createAuthLink({ ttlSeconds: 7_200 });

    first.resolve(authLink);
    await firstRun;
    expect(harness.console.authLinkCreating.value).toBe(true);

    second.resolve(authLink);
    await secondRun;
    expect(harness.console.authLinkCreating.value).toBe(false);
  });

  it("late legacy success/error/finally after disposal cannot render anything", async () => {
    installHappyApis();
    const reports = deferred<unknown>();
    const action = deferred<unknown>();
    adminApi.fetchAdminReports.mockReturnValueOnce(reports.promise);
    adminApi.postAdminPostAction.mockReturnValueOnce(action.promise);
    const harness = makeConsole();
    const reportsRun = harness.console.loadReports("pending");
    const actionRun = harness.console.applyPostAction(1, "hide");

    harness.lane.value = "disposed";
    harness.authEpoch.value += 1;
    harness.console.dispose?.();
    reports.resolve({ items: [report], total: 1 });
    action.reject(new Error("late raw failure"));
    await Promise.all([reportsRun, actionRun]);

    expect(harness.console.reports.value).toEqual([]);
    expect(harness.console.reportsError.value).toBe("");
    expect(harness.console.actionMessage.value).toBe("");
    expect(harness.console.actionError.value).toBe("");
    expect(harness.console.reportsLoading.value).toBe(false);
  });
});
