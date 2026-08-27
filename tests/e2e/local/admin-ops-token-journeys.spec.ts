import { expect, test, type Page, type Request, type TestInfo } from "@playwright/test";

const OPS_TOKEN_KEY = "lian.adminToken";
const OPS_TOKEN = "rc1-r1-explicit-ops-token";
const RETIRED_PATH_FRAGMENT = "/api/admin/laplatform";

interface ApiFixture {
  adminRequests: Request[];
  uploadRequests: Request[];
  savedMapBodies: Array<Record<string, unknown>>;
  releaseReports(): void;
}

const MAP_DOCUMENT = {
  ok: true,
  bounds: { south: 18.37, west: 109.98, north: 18.42, east: 110.05 },
  locations: { version: 1, coordSystem: "gcj02", items: [] },
  layers: {
    version: 1,
    coordSystem: "gcj02",
    center: { lat: 18.4, lng: 110.01 },
    zoom: 16,
    areas: [],
    routes: [],
    roads: [],
    assets: [],
  },
};

function isApiRequest(url: URL | string): boolean {
  return new URL(url).pathname.startsWith("/api/");
}

async function installApi(
  page: Page,
  options: { holdReports?: boolean } = {},
): Promise<ApiFixture> {
  const adminRequests: Request[] = [];
  const uploadRequests: Request[] = [];
  const savedMapBodies: Array<Record<string, unknown>> = [];
  let releaseReports!: () => void;
  const reportsGate = new Promise<void>((resolve) => {
    releaseReports = resolve;
  });

  await page.route(isApiRequest, async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (pathname.startsWith("/api/admin/")) {
      adminRequests.push(request);
      if (pathname === "/api/admin/map-v2/assets" && request.method() === "POST") {
        uploadRequests.push(request);
        await route.fulfill({ status: 200, json: { url: "/assets/test-camera.png" } });
        return;
      }
      if (pathname === "/api/admin/map-v2") {
        if (request.method() === "PUT") {
          const body = request.postDataJSON() as Record<string, unknown>;
          savedMapBodies.push(body);
          await route.fulfill({ status: 200, json: { ...MAP_DOCUMENT, ...body } });
        } else {
          await route.fulfill({ status: 200, json: MAP_DOCUMENT });
        }
        return;
      }
      if (pathname === "/api/admin/reports" && options.holdReports) await reportsGate;
      await route.fulfill({ status: 200, json: { items: [], total: 0 } });
      return;
    }

    if (pathname === "/api/auth/me") {
      await route.fulfill({
        status: 200,
        json: { user: { id: "session-user", username: "Session User" } },
      });
      return;
    }

    await route.fulfill({ status: 200, json: {} });
  });

  return { adminRequests, uploadRequests, savedMapBodies, releaseReports };
}

async function preloadToken(page: Page, value = OPS_TOKEN) {
  await page.addInitScript(({ key, token }) => window.sessionStorage.setItem(key, token), {
    key: OPS_TOKEN_KEY,
    token: value,
  });
}

async function installSessionCookie(page: Page, testInfo: TestInfo) {
  await page.context().addCookies([
    {
      url: String(testInfo.project.use.baseURL),
      name: "lian_session",
      value: "hermetic-session-user",
      sameSite: "Lax",
    },
  ]);
}

function expectNoRetiredProviderRequest(fixture: ApiFixture) {
  expect(
    fixture.adminRequests.filter((request) =>
      new URL(request.url()).pathname.toLowerCase().includes(RETIRED_PATH_FRAGMENT),
    ),
  ).toEqual([]);
}

test.describe("@local-admin-r1 retired provider boundary", () => {
  test("a signed-in session user sees the ops-token gate and sends no admin provider request", async ({
    page,
  }, testInfo) => {
    const fixture = await installApi(page);
    await installSessionCookie(page, testInfo);

    await page.goto("/#/admin");

    await expect(page.getByRole("heading", { name: "运维令牌备用入口" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "商户目录" })).toHaveCount(0);
    expect(fixture.adminRequests).toEqual([]);
    expectNoRetiredProviderRequest(fixture);
  });

  test("a stored legacy token reaches reports, verification, auth links, and audit", async ({
    page,
  }) => {
    const fixture = await installApi(page);
    await preloadToken(page);

    await page.goto("/#/admin");

    await expect(page.getByTestId("admin-queue-empty")).toBeVisible();
    await page.getByRole("tab", { name: "认证审核" }).click();
    await expect(page.getByTestId("admin-verification-empty")).toBeVisible();
    await page.getByRole("tab", { name: "邀请链接" }).click();
    await expect(page.getByTestId("admin-auth-link-empty")).toBeVisible();
    await page.getByRole("tab", { name: "审计日志" }).click();
    await expect(page.getByTestId("admin-audit-empty")).toBeVisible();

    const calledPaths = fixture.adminRequests.map((request) => new URL(request.url()).pathname);
    expect(calledPaths).toEqual([
      "/api/admin/reports",
      "/api/admin/verifications",
      "/api/admin/auth-links",
      "/api/admin/audit-log",
    ]);
    for (const request of fixture.adminRequests) {
      expect(request.headers().authorization).toBe(`Bearer ${OPS_TOKEN}`);
    }
    expectNoRetiredProviderRequest(fixture);
  });

  test("the ops-token map tab uploads an asset and saves the Konva document", async ({ page }) => {
    const fixture = await installApi(page);
    await preloadToken(page);
    await page.goto("/#/admin");
    await expect(page.getByTestId("admin-queue-empty")).toBeVisible();

    await page.getByRole("tab", { name: "地图编辑" }).click();
    await expect(page.locator('[data-testid="konva-map-stage"] canvas').first()).toBeVisible();

    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    );
    await page.getByTestId("admin-map-upload").setInputFiles({
      name: "camera.png",
      mimeType: "image/png",
      buffer: png,
    });

    await expect(page.getByText("素材已上传并放到地图中心")).toBeVisible();
    await page.getByLabel("宽").fill("72");
    await page.getByTestId("admin-map-save").click();
    await expect(page.getByText("地图已保存并重新读取服务端结果")).toBeVisible();

    expect(fixture.uploadRequests).toHaveLength(1);
    expect(fixture.uploadRequests[0]?.headers().authorization).toBe(`Bearer ${OPS_TOKEN}`);
    expect(fixture.savedMapBodies).toHaveLength(1);
    const layers = fixture.savedMapBodies[0]?.layers as {
      assets?: Array<{ kind?: string; url?: string; size?: number[] }>;
    };
    expect(layers.assets).toHaveLength(1);
    expect(layers.assets?.[0]).toMatchObject({
      kind: "camera",
      url: "/assets/test-camera.png",
      size: [72, 48],
    });
    expectNoRetiredProviderRequest(fixture);
  });

  test("exit retires a pending report owner, clears the token, and prevents late admin state", async ({
    page,
  }) => {
    const fixture = await installApi(page, { holdReports: true });
    await preloadToken(page);
    await page.goto("/#/admin");
    await expect.poll(() => fixture.adminRequests.length).toBe(1);

    await page.getByRole("button", { name: "退出管理" }).click();

    await expect(page).toHaveURL(/#\/profile$/);
    expect(
      await page.evaluate((key) => window.sessionStorage.getItem(key), OPS_TOKEN_KEY),
    ).toBeNull();
    fixture.releaseReports();
    await expect(page.getByTestId("admin-queue-empty")).toHaveCount(0);
    expectNoRetiredProviderRequest(fixture);
  });

  test("navigate-away unmount retires pending work and clears the explicit token", async ({
    page,
  }) => {
    const fixture = await installApi(page, { holdReports: true });
    await preloadToken(page);
    await page.goto("/#/admin");
    await expect.poll(() => fixture.adminRequests.length).toBe(1);

    await page.goto("/#/feed");

    expect(
      await page.evaluate((key) => window.sessionStorage.getItem(key), OPS_TOKEN_KEY),
    ).toBeNull();
    fixture.releaseReports();
    await expect(page.getByRole("button", { name: "退出管理" })).toHaveCount(0);
    expectNoRetiredProviderRequest(fixture);
  });
});
