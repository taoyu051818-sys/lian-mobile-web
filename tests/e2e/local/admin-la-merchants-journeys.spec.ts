import { expect, test, type Page, type Request, type Route, type TestInfo } from "@playwright/test";

const OPS_TOKEN_KEY = "lian.adminToken";
const SENTINEL = "SENTINEL_OPS_TOKEN_MUST_NOT_LEAK_7f3c";
const REQUEST_ID = "3f5a9c26-6571-4d6c-9c70-3517b2a7f4d8";
const BFF_PATH = "/api/admin/laplatform/merchants";

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

type ResponsePlan =
  | {
      kind?: "response";
      status: number;
      body?: unknown;
      headers?: Record<string, string>;
      wait?: Promise<void>;
    }
  | { kind: "network"; wait?: Promise<void> }
  | { kind: "redirect"; location?: string; wait?: Promise<void> };

interface ApiFixture {
  merchantRequests: Request[];
  adminMeRequests: Request[];
  legacyRequests: Request[];
  reportsRequests: Request[];
  authLoginRequests: Request[];
  authLogoutRequests: Request[];
  releaseReports: () => void;
}

function merchantEnvelope(url: URL, id = "merchant_demo", total = 1) {
  const limit = Number(url.searchParams.get("limit") ?? "20");
  const offset = Number(url.searchParams.get("offset") ?? "0");
  return {
    data:
      id === ""
        ? []
        : [
            {
              id,
              code: `${id}.code`,
              displayName:
                id === "unsafe" ? `<img src=x onerror="window.__xss=1">` : `Merchant ${id}`,
              status: "active",
              createdAt: "2026-08-11T00:00:00.000Z",
              updatedAt: "2026-08-11T01:02:03.004Z",
            },
          ],
    page: { limit, offset, total },
    meta: { requestId: REQUEST_ID, schemaVersion: "v1" },
  };
}

async function fulfill(route: Route, plan: ResponsePlan, request: Request) {
  if (plan.wait) await plan.wait;
  if (plan.kind === "network") {
    await route.abort("connectionrefused");
    return;
  }
  if (plan.kind === "redirect") {
    await route.fulfill({
      status: 302,
      headers: { location: plan.location ?? "https://evil.invalid/login?token=raw" },
      body: "redirecting with raw secret",
    });
    return;
  }

  const headers = { ...plan.headers };
  if (plan.body !== undefined) headers["content-type"] = "application/json; charset=utf-8";
  await route.fulfill({
    status: plan.status,
    headers,
    body: plan.body === undefined ? undefined : JSON.stringify(plan.body),
  });
  void request;
}

async function installApi(
  page: Page,
  plans: ResponsePlan[],
  options: {
    holdReports?: boolean;
    reportsError?: boolean;
    profileAuthenticated?: boolean;
  } = {},
): Promise<ApiFixture> {
  const merchantRequests: Request[] = [];
  const adminMeRequests: Request[] = [];
  const legacyRequests: Request[] = [];
  const reportsRequests: Request[] = [];
  const authLoginRequests: Request[] = [];
  const authLogoutRequests: Request[] = [];
  const reportsGate = deferred<void>();
  const profileUser = { id: "account-b", username: "Account B" };
  let profileAuthenticated = options.profileAuthenticated ?? false;
  let planIndex = 0;

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === BFF_PATH) {
      const rawOffset = url.searchParams.get("offset");
      expect(rawOffset).toMatch(/^(?:0|[1-9]\d*)$/);
      const offset = Number(rawOffset);
      expect(Number.isSafeInteger(offset)).toBe(true);
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset).toBeLessThanOrEqual(1_000_000);
      expect(url.searchParams.has("page")).toBe(false);
      merchantRequests.push(request);
      const plan = plans[planIndex++] ?? {
        status: 200,
        body: merchantEnvelope(url, `merchant-${planIndex}`, 100),
      };
      await fulfill(route, plan, request);
      return;
    }
    if (url.pathname === "/api/admin/me") {
      adminMeRequests.push(request);
      await route.fulfill({ status: 500, json: { error: "legacy probe must not be called" } });
      return;
    }
    if (url.pathname === "/api/admin/reports") {
      legacyRequests.push(request);
      reportsRequests.push(request);
      if (options.holdReports) await reportsGate.promise;
      await route.fulfill(
        options.reportsError
          ? { status: 500, json: { error: "raw legacy failure" } }
          : { status: 200, json: { items: [], total: 0 } },
      );
      return;
    }
    if (url.pathname.startsWith("/api/admin/")) {
      legacyRequests.push(request);
      await route.fulfill({ status: 200, json: { items: [], total: 0 } });
      return;
    }
    if (url.pathname === "/api/auth/me") {
      await route.fulfill({
        status: 200,
        json: { user: profileAuthenticated ? profileUser : null },
      });
      return;
    }
    if (url.pathname === "/api/auth/login") {
      authLoginRequests.push(request);
      profileAuthenticated = true;
      await route.fulfill({ status: 200, json: { user: profileUser } });
      return;
    }
    if (url.pathname === "/api/auth/logout") {
      authLogoutRequests.push(request);
      profileAuthenticated = false;
      await route.fulfill({ status: 200, json: {} });
      return;
    }
    await route.fulfill({ status: 200, json: {} });
  });

  return {
    merchantRequests,
    adminMeRequests,
    legacyRequests,
    reportsRequests,
    authLoginRequests,
    authLogoutRequests,
    releaseReports: reportsGate.resolve,
  };
}

async function preloadToken(page: Page, token = SENTINEL) {
  await page.addInitScript(({ key, value }) => window.sessionStorage.setItem(key, value), {
    key: OPS_TOKEN_KEY,
    value: token,
  });
}

async function installSessionCookie(page: Page, testInfo: TestInfo) {
  const baseURL = String(testInfo.project.use.baseURL);
  await page
    .context()
    .addCookies([
      { url: baseURL, name: "lian_session", value: "hermetic-cookie-session", sameSite: "Lax" },
    ]);
}

async function openAdmin(page: Page, fixture: ApiFixture) {
  await page.goto("/#/admin");
  await expect
    .poll(() => fixture.merchantRequests.length, { timeout: 1_500, message: "initial BFF request" })
    .toBe(1);
}

async function storedToken(page: Page) {
  return page.evaluate((key) => window.sessionStorage.getItem(key), OPS_TOKEN_KEY);
}

async function storeToken(page: Page, value = SENTINEL) {
  await page.evaluate(({ key, token }) => window.sessionStorage.setItem(key, token), {
    key: OPS_TOKEN_KEY,
    token: value,
  });
}

function strictPlan(status = 200, id = "merchant_demo", total = 1): ResponsePlan {
  return {
    status,
    body: merchantEnvelope(new URL(`http://local.invalid${BFF_PATH}?limit=20&offset=0`), id, total),
  };
}

test.describe("@local-admin-la first merchants capability journey", () => {
  test("pending bootstrap has no privileged flash even with a stored ops token", async ({
    page,
  }, testInfo) => {
    const gate = deferred<void>();
    await preloadToken(page);
    await installSessionCookie(page, testInfo);
    const fixture = await installApi(page, [{ ...strictPlan(), wait: gate.promise }]);
    await page.goto("/#/admin");
    await expect.poll(() => fixture.merchantRequests.length, { timeout: 1_500 }).toBe(1);

    await expect(page.getByTestId("admin-access-probing")).toBeVisible();
    await expect(page.getByTestId("admin-la-merchants-block")).toHaveCount(0);
    await expect(page.locator(".admin-reports-block")).toHaveCount(0);
    await expect(page.locator(".admin-verification-block")).toHaveCount(0);
    await expect(page.locator(".admin-auth-link-block")).toHaveCount(0);
    await expect(page.locator(".admin-audit-block")).toHaveCount(0);
    await expect(page.locator(".admin-token-gate")).toHaveCount(0);
    await expect(page.getByTestId("shell-chrome-tab-merchants")).toHaveCount(0);
    expect(await storedToken(page)).toBe(SENTINEL);

    gate.resolve();
    await expect(page.getByTestId("admin-la-merchants-block")).toBeVisible();
  });

  for (const status of [200, 299]) {
    test(`strict ${status} success is adopted as the first queue with no duplicate`, async ({
      page,
    }, testInfo) => {
      await preloadToken(page);
      await installSessionCookie(page, testInfo);
      const fixture = await installApi(page, [strictPlan(status, `success-${status}`)]);

      await openAdmin(page, fixture);

      await expect(page.getByTestId("admin-la-merchant-row")).toHaveCount(1);
      await expect(page.getByTestId("admin-la-merchant-row")).toContainText(`success-${status}`);
      await expect(page.getByTestId("shell-chrome-tab-merchants")).toHaveCount(1);
      for (const legacyTab of ["reports", "verifications", "auth-links", "audit"]) {
        await expect(page.getByTestId(`shell-chrome-tab-${legacyTab}`)).toHaveCount(0);
      }
      await expect(page.locator(".admin-reports-block")).toHaveCount(0);
      await expect(page.locator(".admin-verification-block")).toHaveCount(0);
      await expect(page.locator(".admin-auth-link-block")).toHaveCount(0);
      await expect(page.locator(".admin-audit-block")).toHaveCount(0);
      expect(fixture.merchantRequests).toHaveLength(1);
      expect(fixture.adminMeRequests).toHaveLength(0);
      expect(fixture.legacyRequests).toHaveLength(0);
      expect(await storedToken(page)).toBe(SENTINEL);
    });
  }

  test("the real intercepted request contains only the cookie auth channel and never the sentinel", async ({
    page,
  }, testInfo) => {
    await preloadToken(page);
    await installSessionCookie(page, testInfo);
    const fixture = await installApi(page, [strictPlan()]);
    await openAdmin(page, fixture);
    const request = fixture.merchantRequests[0];
    const headers = request.headers();

    expect(request.method()).toBe("GET");
    expect(new URL(request.url()).pathname + new URL(request.url()).search).toBe(
      `${BFF_PATH}?limit=20&offset=0`,
    );
    expect(headers.authorization).toBeUndefined();
    expect(headers["x-admin-token"]).toBeUndefined();
    expect(headers.cookie).toContain("lian_session=hermetic-cookie-session");
    expect(request.postData()).toBeNull();
    expect(JSON.stringify({ url: request.url(), headers, body: request.postData() })).not.toContain(
      SENTINEL,
    );
    await expect(page.locator("body")).not.toContainText(SENTINEL);
  });

  test("a strict zero-row envelope alone renders empty", async ({ page }) => {
    const fixture = await installApi(page, [strictPlan(200, "", 0)]);
    await openAdmin(page, fixture);
    await expect(page.getByTestId("admin-la-merchants-empty")).toBeVisible();
    await expect(page.getByTestId("admin-la-merchant-row")).toHaveCount(0);
    await expect(page.getByTestId("admin-probe-error")).toHaveCount(0);
  });

  for (const [name, plan] of [
    ["204 bodyless", { status: 204 }],
    ["malformed 200", { status: 200, body: {} }],
    ["malformed 299", { status: 299, body: "<html>raw secret</html>" }],
  ] as const) {
    test(`${name} never authorizes or renders empty`, async ({ page }) => {
      const fixture = await installApi(page, [plan]);
      await openAdmin(page, fixture);
      await expect(page.getByTestId("admin-probe-error")).toHaveAttribute(
        "data-code",
        "MALFORMED_RESPONSE",
      );
      await expect(page.getByTestId("admin-la-merchants-empty")).toHaveCount(0);
      await expect(page.getByTestId("admin-la-merchants-block")).toHaveCount(0);
      await expect(page.locator("body")).not.toContainText(/raw secret|html/i);
    });
  }

  test("merchant values are text-only and cannot create attacker DOM", async ({ page }) => {
    const fixture = await installApi(page, [strictPlan(200, "unsafe")]);
    await openAdmin(page, fixture);
    const row = page.getByTestId("admin-la-merchant-row");
    await expect(row).toContainText('<img src=x onerror="window.__xss=1">');
    await expect(row.locator("img")).toHaveCount(0);
    expect(await page.evaluate(() => Reflect.get(window, "__xss"))).toBeUndefined();
  });
});

const initialFailures: Array<{
  name: string;
  plan: ResponsePlan;
  code: string;
  lane: "gate" | "probe-error";
  retry: boolean;
}> = [
  {
    name: "400",
    plan: { status: 400, body: { error: "raw q=secret" } },
    code: "REQUEST_CONTRACT",
    lane: "probe-error",
    retry: false,
  },
  {
    name: "401",
    plan: { status: 401, body: { error: "raw token" } },
    code: "AUTH_REQUIRED",
    lane: "gate",
    retry: false,
  },
  {
    name: "403",
    plan: { status: 403, body: { error: "raw role" } },
    code: "CAPABILITY_REQUIRED",
    lane: "gate",
    retry: false,
  },
  {
    name: "404",
    plan: { status: 404, body: { error: "raw url" } },
    code: "BFF_NOT_DEPLOYED",
    lane: "probe-error",
    retry: false,
  },
  {
    name: "428",
    plan: { status: 428, body: { error: "raw prerequisite" } },
    code: "PREREQUISITE_UNAVAILABLE",
    lane: "probe-error",
    retry: false,
  },
  {
    name: "429",
    plan: { status: 429, body: { error: "raw limit" } },
    code: "RATE_LIMITED",
    lane: "probe-error",
    retry: true,
  },
  {
    name: "499",
    plan: { status: 499, body: { error: "raw aborted" } },
    code: "TEMPORARILY_UNAVAILABLE",
    lane: "probe-error",
    retry: true,
  },
  {
    name: "500",
    plan: { status: 500, body: { error: "raw stack" } },
    code: "TEMPORARILY_UNAVAILABLE",
    lane: "probe-error",
    retry: true,
  },
  {
    name: "502",
    plan: { status: 502, body: { error: "raw proxy" } },
    code: "TEMPORARILY_UNAVAILABLE",
    lane: "probe-error",
    retry: true,
  },
  {
    name: "503",
    plan: { status: 503, body: { error: "raw flag" } },
    code: "INTEGRATION_UNAVAILABLE",
    lane: "probe-error",
    retry: true,
  },
  {
    name: "504",
    plan: { status: 504, body: { error: "raw timeout" } },
    code: "TEMPORARILY_UNAVAILABLE",
    lane: "probe-error",
    retry: true,
  },
  {
    name: "unknown 418",
    plan: { status: 418, body: { error: "raw tea" } },
    code: "HTTP_FAILURE",
    lane: "probe-error",
    retry: true,
  },
  {
    name: "redirect",
    plan: { kind: "redirect" },
    code: "NETWORK_FAILURE",
    lane: "probe-error",
    retry: true,
  },
  {
    name: "network",
    plan: { kind: "network" },
    code: "NETWORK_FAILURE",
    lane: "probe-error",
    retry: true,
  },
  {
    name: "204 bodyless",
    plan: { status: 204 },
    code: "MALFORMED_RESPONSE",
    lane: "probe-error",
    retry: true,
  },
  {
    name: "malformed",
    plan: { status: 200, body: { data: "raw" } },
    code: "MALFORMED_RESPONSE",
    lane: "probe-error",
    retry: true,
  },
];

test.describe("@local-admin-la complete initial failure FSM", () => {
  for (const failure of initialFailures) {
    test(`${failure.name} without token selects ${failure.lane} and fixed local copy`, async ({
      page,
    }) => {
      const fixture = await installApi(page, [failure.plan]);
      await openAdmin(page, fixture);
      const surface =
        failure.lane === "gate"
          ? page.getByTestId("admin-access-reason")
          : page.getByTestId("admin-probe-error");
      await expect(surface).toHaveAttribute("data-code", failure.code);
      await expect(page.getByTestId("admin-la-merchants-block")).toHaveCount(0);
      await expect(page.locator(".admin-reports-block")).toHaveCount(0);
      await expect(page.locator("body")).not.toContainText(
        /raw q|raw token|raw role|raw url|raw stack|evil\.invalid/i,
      );
      const retry = page.getByTestId("admin-merchants-retry");
      if (failure.retry) await expect(retry).toBeVisible();
      else await expect(retry).toHaveCount(0);
      expect(fixture.merchantRequests).toHaveLength(1);
    });

    test(`${failure.name} with stored token enters ops only after settlement and loads reports once`, async ({
      page,
    }) => {
      const gate = deferred<void>();
      await preloadToken(page);
      const fixture = await installApi(page, [
        { ...failure.plan, wait: gate.promise } as ResponsePlan,
      ]);
      await page.goto("/#/admin");
      await expect.poll(() => fixture.merchantRequests.length, { timeout: 1_500 }).toBe(1);
      await expect(page.getByTestId("admin-access-probing")).toBeVisible();
      expect(fixture.reportsRequests).toHaveLength(0);

      gate.resolve();
      await expect.poll(() => fixture.reportsRequests.length).toBe(1);
      await expect(page.locator(".admin-reports-block")).toBeVisible();
      await expect(page.getByTestId("admin-la-merchants-block")).toHaveCount(0);
      expect(fixture.merchantRequests).toHaveLength(1);
    });
  }

  test("explicit token submit starts reports once while empty, duplicate, and stale submits start none", async ({
    page,
  }) => {
    const fixture = await installApi(page, [initialFailures[1].plan]);
    await openAdmin(page, fixture);
    const input = page.locator(".admin-token-gate input");
    const submit = page.locator(".admin-token-gate button");
    await submit.click();
    expect(fixture.reportsRequests).toHaveLength(0);

    await input.fill("  explicit-ops-token  ");
    const retainedSubmit = await submit.elementHandle();
    expect(retainedSubmit).not.toBeNull();
    await retainedSubmit!.evaluate((element) => {
      (element as HTMLButtonElement).click();
      (element as HTMLButtonElement).click();
    });
    await expect.poll(() => fixture.reportsRequests.length).toBe(1);
    expect(fixture.reportsRequests[0].headers().authorization).toBe("Bearer explicit-ops-token");
    await expect(submit).toHaveCount(0);
    await retainedSubmit!.evaluate((element) => (element as HTMLButtonElement).click());
    await expect.poll(() => fixture.reportsRequests.length).toBe(1);
    const tabs = page.getByRole("tablist", { name: "管理后台标签" }).getByRole("tab");
    await expect(tabs).toHaveCount(4);
    expect(
      await tabs.evaluateAll((items) => items.map((item) => item.getAttribute("data-testid"))),
    ).toEqual([
      "shell-chrome-tab-reports",
      "shell-chrome-tab-verifications",
      "shell-chrome-tab-auth-links",
      "shell-chrome-tab-audit",
    ]);
    await expect(page.getByTestId("admin-la-merchants-block")).toHaveCount(0);
  });
});

test.describe("@local-admin-la established merchants failures", () => {
  for (const failure of initialFailures) {
    test(`later ${failure.name} stays bounded and never escalates to stored-token ops`, async ({
      page,
    }) => {
      await preloadToken(page);
      const fixture = await installApi(page, [strictPlan(), failure.plan]);
      await openAdmin(page, fixture);
      await expect(page.getByTestId("admin-la-merchant-row")).toHaveCount(1);

      await page.getByTestId("admin-la-merchants-refresh").click();
      await expect.poll(() => fixture.merchantRequests.length).toBe(2);
      expect(fixture.reportsRequests).toHaveLength(0);
      await expect(page.getByTestId("admin-la-merchant-row")).toHaveCount(0);

      if (failure.code === "AUTH_REQUIRED" || failure.code === "CAPABILITY_REQUIRED") {
        await expect(page.getByTestId("admin-access-reason")).toHaveAttribute(
          "data-code",
          failure.code,
        );
        expect(await storedToken(page)).toBeNull();
        await expect(page.getByTestId("admin-la-merchants-block")).toHaveCount(0);
      } else {
        await expect(page.getByTestId("admin-la-merchants-error")).toHaveAttribute(
          "data-code",
          failure.code,
        );
        await expect(page.getByTestId("admin-la-merchants-block")).toBeVisible();
        expect(await storedToken(page)).toBe(SENTINEL);
      }
    });
  }

  test("manual retry snapshots the failed query and issues exactly one new request", async ({
    page,
  }) => {
    const fixture = await installApi(page, [
      strictPlan(),
      initialFailures[9].plan,
      strictPlan(200, "retried"),
    ]);
    await openAdmin(page, fixture);
    await page.getByTestId("admin-la-merchants-refresh").click();
    await expect(page.getByTestId("admin-la-merchants-error")).toBeVisible();
    await page.getByTestId("admin-merchants-retry").click();
    await expect(page.getByTestId("admin-la-merchant-row")).toContainText("retried");
    expect(fixture.merchantRequests).toHaveLength(3);
  });

  for (const seconds of [1, 60]) {
    test(`429 ${seconds}s cooldown owns no automatic retry`, async ({ page }) => {
      await page.clock.install();
      const fixture = await installApi(page, [
        strictPlan(),
        { status: 429, headers: { "retry-after": String(seconds) }, body: { error: "raw" } },
        strictPlan(200, "after-cooldown"),
      ]);
      await openAdmin(page, fixture);
      await page.getByTestId("admin-la-merchants-refresh").click();
      const retry = page.getByTestId("admin-merchants-retry");
      await expect(retry).toBeDisabled();
      await page.clock.fastForward(seconds * 1_000);
      expect(fixture.merchantRequests).toHaveLength(2);
      await expect(retry).toBeEnabled();
      await retry.click();
      expect(fixture.merchantRequests).toHaveLength(3);
    });
  }

  test("missing, invalid, and over-60 retry values create no timer", async ({ page }) => {
    for (const value of [undefined, "0", "-1", "61", "not-a-date"] as const) {
      const headers: Record<string, string> = value === undefined ? {} : { "retry-after": value };
      const fixture = await installApi(page, [
        strictPlan(),
        { status: 429, headers, body: { error: "raw" } },
      ]);
      await openAdmin(page, fixture);
      await page.getByTestId("admin-la-merchants-refresh").click();
      await expect(page.getByTestId("admin-merchants-retry")).toBeEnabled();
      await page.goto("/about:blank").catch(() => undefined);
      await page.unrouteAll({ behavior: "ignoreErrors" });
    }
  });
});

test.describe("@local-admin-la query, pagination and request ownership", () => {
  test("q/status/next/previous build canonical bounded URLs and disabled total Next is guarded", async ({
    page,
  }) => {
    const fixture = await installApi(page, [strictPlan(200, "initial", 100)]);
    await openAdmin(page, fixture);
    const search = page.getByTestId("admin-la-merchants-search");
    await search.fill("  north & east  ");
    await search.press("Enter");
    await expect.poll(() => fixture.merchantRequests.length).toBe(2);
    expect(new URL(fixture.merchantRequests[1].url()).search).toBe(
      "?limit=20&offset=0&q=north+%26+east",
    );

    await page.getByTestId("admin-la-merchants-status-active").click();
    await expect.poll(() => fixture.merchantRequests.length).toBe(3);
    expect(new URL(fixture.merchantRequests[2].url()).search).toBe(
      "?limit=20&offset=0&q=north+%26+east&status=active",
    );

    await page.getByTestId("admin-la-merchants-next").click();
    await expect.poll(() => fixture.merchantRequests.length).toBe(4);
    expect(new URL(fixture.merchantRequests[3].url()).searchParams.get("offset")).toBe("20");
    await page.getByTestId("admin-la-merchants-previous").click();
    await expect.poll(() => fixture.merchantRequests.length).toBe(5);
    expect(new URL(fixture.merchantRequests[4].url()).searchParams.get("offset")).toBe("0");

    for (const request of fixture.merchantRequests) {
      const url = new URL(request.url());
      const offset = Number(url.searchParams.get("offset"));
      expect(Number.isSafeInteger(offset)).toBe(true);
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset).toBeLessThanOrEqual(1_000_000);
      expect(url.searchParams.has("page")).toBe(false);
      expect(Array.from(url.searchParams.keys())).toEqual(
        expect.arrayContaining(["limit", "offset"]),
      );
    }
  });

  test("total boundary disables Next and guarded clicks issue zero requests", async ({ page }) => {
    const fixture = await installApi(page, [strictPlan(200, "only", 1)]);
    await openAdmin(page, fixture);
    const next = page.getByTestId("admin-la-merchants-next");
    await expect(next).toBeDisabled();
    await next.click({ force: true });
    expect(fixture.merchantRequests).toHaveLength(1);
  });

  test("new intent physically aborts the predecessor and reverse settlement remains latest-wins", async ({
    page,
  }) => {
    const first = deferred<void>();
    const second = deferred<void>();
    const fixture = await installApi(page, [
      strictPlan(200, "initial", 100),
      { ...strictPlan(200, "stale-first", 100), wait: first.promise },
      { ...strictPlan(200, "current-second", 100), wait: second.promise },
    ]);
    await openAdmin(page, fixture);
    const input = page.getByTestId("admin-la-merchants-search");
    await input.fill("first");
    await input.press("Enter");
    await expect.poll(() => fixture.merchantRequests.length).toBe(2);
    await input.fill("second");
    await input.press("Enter");
    await expect.poll(() => fixture.merchantRequests.length).toBe(3);

    second.resolve();
    await expect(page.getByTestId("admin-la-merchant-row")).toContainText("current-second");
    first.resolve();
    await expect(page.getByTestId("admin-la-merchant-row")).toContainText("current-second");
    expect(fixture.merchantRequests[1].failure()?.errorText ?? "").toMatch(/abort|cancel|failed/i);
  });
});

test.describe("@local-admin-la exit, account and unmount cleanup", () => {
  test("explicit admin exit clears retained token and removes the merchants surface", async ({
    page,
  }) => {
    await preloadToken(page);
    const fixture = await installApi(page, [strictPlan()]);
    await openAdmin(page, fixture);
    expect(await storedToken(page)).toBe(SENTINEL);

    await page.getByRole("button", { name: "退出管理" }).click();
    expect(await storedToken(page)).toBeNull();
    await expect(page.getByTestId("admin-la-merchants-block")).toHaveCount(0);
  });

  test("account change clears a reintroduced stale token and prevents late merchants DOM commit", async ({
    page,
  }) => {
    const gate = deferred<void>();
    await preloadToken(page);
    const fixture = await installApi(page, [
      { ...strictPlan(200, "late-account-a"), wait: gate.promise },
    ]);
    await page.goto("/#/admin");
    await expect.poll(() => fixture.merchantRequests.length, { timeout: 1_500 }).toBe(1);

    await page.goto("/#/profile");
    const authPanel = page.locator(".auth-panel");
    await expect(authPanel).toBeVisible();
    await storeToken(page);
    await authPanel.locator('input[autocomplete="username"]').fill("account-b@example.test");
    await authPanel.locator('input[type="password"]').fill("safe-password-123");
    await authPanel.locator('button[type="submit"]').click();
    await expect.poll(() => fixture.authLoginRequests.length).toBe(1);
    expect(await storedToken(page)).toBeNull();

    gate.resolve();
    await page.waitForTimeout(0);
    await expect(page.getByTestId("admin-la-merchants-block")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("late-account-a");
  });

  test("logout clears a reintroduced stale token and prevents late merchants DOM commit", async ({
    page,
  }) => {
    const gate = deferred<void>();
    await preloadToken(page);
    const fixture = await installApi(
      page,
      [{ ...strictPlan(200, "late-before-logout"), wait: gate.promise }],
      { profileAuthenticated: true },
    );
    await page.goto("/#/admin");
    await expect.poll(() => fixture.merchantRequests.length, { timeout: 1_500 }).toBe(1);

    await page.goto("/#/profile");
    const profileButtons = page.locator(".shell-chrome__buttons button");
    await expect(profileButtons).toHaveCount(2);
    await storeToken(page);
    await profileButtons.last().click();
    await expect.poll(() => fixture.authLogoutRequests.length).toBe(1);
    expect(await storedToken(page)).toBeNull();

    gate.resolve();
    await page.waitForTimeout(0);
    await expect(page.getByTestId("admin-la-merchants-block")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("late-before-logout");
  });

  test("navigate-away/unmount physically aborts merchants, clears the token, and prevents late DOM commit", async ({
    page,
  }) => {
    const gate = deferred<void>();
    await preloadToken(page);
    const fixture = await installApi(page, [
      { ...strictPlan(200, "late-after-unmount"), wait: gate.promise },
    ]);
    await page.goto("/#/admin");
    await expect.poll(() => fixture.merchantRequests.length, { timeout: 1_500 }).toBe(1);

    await page.goto("/#/profile");
    expect(await storedToken(page)).toBeNull();
    gate.resolve();
    await expect
      .poll(() => fixture.merchantRequests[0].failure()?.errorText ?? "")
      .toMatch(/abort|cancel|failed/i);
    await page.waitForTimeout(0);
    await expect(page.getByTestId("admin-la-merchants-block")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("late-after-unmount");
  });

  for (const outcome of ["success", "error"] as const) {
    test(`console logical disposal rejects late ops ${outcome}/finally without claiming physical abort`, async ({
      page,
    }) => {
      await preloadToken(page);
      const fixture = await installApi(page, [initialFailures[1].plan], {
        holdReports: true,
        reportsError: outcome === "error",
      });
      await openAdmin(page, fixture);
      await expect.poll(() => fixture.reportsRequests.length).toBe(1);
      await page.goto("/#/profile");
      expect(await storedToken(page)).toBeNull();

      fixture.releaseReports();
      const response = await fixture.reportsRequests[0].response();
      expect(response?.status()).toBe(outcome === "error" ? 500 : 200);
      expect(fixture.reportsRequests[0].failure()).toBeNull();
      expect(fixture.reportsRequests).toHaveLength(1);
      await expect(page.locator(".admin-reports-block")).toHaveCount(0);
      await expect(page.locator("body")).not.toContainText(/raw legacy failure/i);
    });
  }
});
