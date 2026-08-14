import { expect, test, type Page, type Request, type Route } from "@playwright/test";

const STORE_ONE = {
  id: "1",
  name: "东区校园便利店",
  summary: "日常用品和零食",
  areaLabel: "东区生活区",
  logoAssetRef: null,
  ratings: { description: "4.80", service: "4.90", logistics: "0" },
  salesCount: 12,
  favoriteCount: 3,
  recommended: true,
};

const STORE_TWO = {
  ...STORE_ONE,
  id: "2",
  name: "西区文具铺",
  summary: "打印、文具和学习用品",
  areaLabel: "西区教学楼",
  ratings: { description: "5.00", service: "4.70", logistics: "4.50" },
  recommended: false,
};

interface CommerceFixture {
  authenticated: boolean;
  listStatus: number;
  missingStoreIds: Set<string>;
  commerceRequests: Request[];
  imageRequests: Request[];
  externalRequests: Request[];
}

function requestId(sequence: number) {
  return `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
}

async function commerceJson(route: Route, body: unknown, sequence: number) {
  await route.fulfill({
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Request-Id": requestId(sequence),
    },
    body: JSON.stringify({
      data: body,
      meta: { requestId: requestId(sequence), schemaVersion: "1.0.0" },
    }),
  });
}

async function installCommerceFixture(page: Page): Promise<CommerceFixture> {
  const state: CommerceFixture = {
    authenticated: false,
    listStatus: 200,
    missingStoreIds: new Set(),
    commerceRequests: [],
    imageRequests: [],
    externalRequests: [],
  };
  let sequence = 0;

  page.on("request", (request) => {
    const url = new URL(request.url());
    if (request.resourceType() === "image") state.imageRequests.push(request);
    if (url.hostname === "hostile-commerce.invalid") state.externalRequests.push(request);
  });

  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === "/api/commerce/stores") {
      state.commerceRequests.push(request);
      if (state.listStatus !== 200) {
        await route.fulfill({
          status: state.listStatus,
          contentType: "application/json",
          body: "{}",
        });
        return;
      }
      sequence += 1;
      await commerceJson(
        route,
        {
          items: [STORE_ONE, STORE_TWO],
          page: { page: 1, pageSize: 20, total: 2, hasMore: false },
        },
        sequence,
      );
      return;
    }

    const detail = /^\/api\/commerce\/stores\/([1-9][0-9]*)$/.exec(path);
    if (detail) {
      state.commerceRequests.push(request);
      const storeId = detail[1];
      if (state.missingStoreIds.has(storeId)) {
        await route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
        return;
      }
      sequence += 1;
      await commerceJson(route, { store: storeId === "2" ? STORE_TWO : STORE_ONE }, sequence);
      return;
    }

    if (path === "/api/auth/me") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: state.authenticated
            ? {
                id: "commerce-reader",
                username: "商城浏览用户",
                tags: [],
                identityTags: [],
                verificationTags: [],
                aliases: [],
              }
            : null,
        }),
      });
      return;
    }

    if (path === "/api/me/stats") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          posts: 0,
          replies: 0,
          saved: 0,
          liked: 0,
          drafts: 0,
          mapContributions: 0,
        }),
      });
      return;
    }
    if (path === "/api/me/settings") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          notificationEnabled: false,
          profileVisibility: "public",
          allowMessageMentions: true,
        }),
      });
      return;
    }
    if (path === "/api/me/posts") {
      await route.fulfill({ status: 200, contentType: "application/json", body: '{"items":[]}' });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  return state;
}

function commercePaths(requests: Request[]) {
  return requests.map((request) => {
    const url = new URL(request.url());
    return `${url.pathname}${url.search}`;
  });
}

test.describe("@local-commerce anonymous store-read journeys", () => {
  test("Profile exposes one real loading-safe anchor to both guest and authenticated readers", async ({
    page,
  }) => {
    const fixture = await installCommerceFixture(page);
    await page.goto("/#/profile");

    await expect(page.locator(".auth-panel")).toBeVisible();
    const guestEntry = page.getByTestId("profile-commerce-entry").locator("a");
    await expect(guestEntry).toBeVisible();
    await expect(guestEntry).toHaveAttribute("href", "#/commerce");

    fixture.authenticated = true;
    await page.reload();
    await expect(page.locator(".profile-view__authenticated")).toBeVisible();
    const authenticatedEntry = page.getByTestId("profile-commerce-entry").locator("a");
    await expect(authenticatedEntry).toBeVisible();
    await expect(authenticatedEntry).toHaveAttribute("href", "#/commerce");
    expect(fixture.commerceRequests).toHaveLength(0);
  });

  test("cold refresh, real anchors, back/forward, and duplicate history events keep one route owner", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Reflect.set(window, "LIAN_API_BASE_URL", "https://hostile-commerce.invalid/private");
    });
    const fixture = await installCommerceFixture(page);

    await page.goto("/#/commerce");
    await expect(page.getByTestId("commerce-list-page")).toBeVisible();
    await expect(page.locator(".commerce-store-card")).toHaveCount(2);
    expect(commercePaths(fixture.commerceRequests)).toEqual(["/api/commerce/stores"]);

    const firstRequest = fixture.commerceRequests[0];
    expect(firstRequest.method()).toBe("GET");
    expect(firstRequest.postData()).toBeNull();
    expect(firstRequest.headers().accept).toContain("application/json");
    expect(firstRequest.headers()["x-client-id"]).toBeUndefined();
    expect(new URL(firstRequest.url()).origin).toBe(new URL(page.url()).origin);

    await page.evaluate(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    await page.waitForTimeout(50);
    expect(fixture.commerceRequests).toHaveLength(1);

    await page.reload();
    await expect(page.locator(".commerce-store-card")).toHaveCount(2);
    expect(commercePaths(fixture.commerceRequests)).toEqual([
      "/api/commerce/stores",
      "/api/commerce/stores",
    ]);

    const storeAnchor = page.getByTestId("commerce-store-1").locator("a");
    await expect(storeAnchor).toHaveAttribute("href", "#/commerce/stores/1");
    await storeAnchor.click();
    await expect(page.getByTestId("commerce-detail-page")).toContainText(STORE_ONE.name);
    expect(commercePaths(fixture.commerceRequests).at(-1)).toBe("/api/commerce/stores/1");

    await page.reload();
    await expect(page.getByTestId("commerce-detail-page")).toContainText(STORE_ONE.name);
    expect(
      commercePaths(fixture.commerceRequests).filter((path) => path.endsWith("/1")),
    ).toHaveLength(2);

    await page.goBack();
    await expect(page.locator(".commerce-store-card")).toHaveCount(2);
    expect(
      commercePaths(fixture.commerceRequests).filter((path) => path === "/api/commerce/stores"),
    ).toHaveLength(3);

    await page.goForward();
    await expect(page.getByTestId("commerce-detail-page")).toContainText(STORE_ONE.name);
    expect(
      commercePaths(fixture.commerceRequests).filter((path) => path.endsWith("/1")),
    ).toHaveLength(3);

    await expect(page.locator(".commerce-view img, .commerce-view picture")).toHaveCount(0);
    expect(
      fixture.imageRequests.filter((request) => {
        const path = new URL(request.url()).pathname.toLowerCase();
        return path.includes("commerce") || path.endsWith("/null") || path.endsWith("/undefined");
      }),
    ).toHaveLength(0);
    expect(fixture.externalRequests).toHaveLength(0);
  });

  test("list 404 is a safe retryable error, detail 404 is not-found, and invalid hashes add no request", async ({
    page,
  }) => {
    const fixture = await installCommerceFixture(page);
    fixture.listStatus = 404;
    await page.goto("/#/commerce");
    await expect(page.getByTestId("commerce-error")).toBeVisible();
    await expect(page.getByTestId("commerce-empty")).toHaveCount(0);
    await expect(page.getByTestId("commerce-closed")).toHaveCount(0);

    fixture.listStatus = 200;
    await page.getByRole("button", { name: "重新加载" }).click();
    await expect(page.locator(".commerce-store-card")).toHaveCount(2);

    fixture.missingStoreIds.add("2");
    await page.getByTestId("commerce-store-2").locator("a").click();
    await expect(page.getByTestId("commerce-not-found")).toBeVisible();
    await expect(page.getByTestId("commerce-error")).toHaveCount(0);

    const beforeInvalid = fixture.commerceRequests.length;
    await page.evaluate(() => {
      window.location.hash = "#/commerce/stores/%31";
    });
    await expect(page.getByTestId("commerce-not-found")).toBeVisible();
    await page.waitForTimeout(50);
    expect(fixture.commerceRequests).toHaveLength(beforeInvalid);
  });
});
