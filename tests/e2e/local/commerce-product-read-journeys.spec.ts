import { expect, test, type Page, type Request, type Route } from "@playwright/test";

const STORE = {
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

function product(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    storeId: "1",
    name: `校园商品 ${id}`,
    subtitle: "适合日常校园生活",
    coverAssetRef: null,
    priceRange: { currency: "CNY", minAmountMinor: 1290, maxAmountMinor: 1590 },
    availability: "available",
    rating: "4.80",
    salesCount: 12,
    recommended: id === "10",
    ...overrides,
  };
}

const PRODUCT_DETAIL = {
  ...product("10"),
  skus: [
    {
      id: "100",
      name: "标准装",
      price: { currency: "CNY", amountMinor: 1290 },
      availability: "available",
      default: true,
    },
    {
      id: "101",
      name: "加量装",
      price: { currency: "CNY", amountMinor: 1590 },
      availability: "available",
      default: false,
    },
    {
      id: "102",
      name: "",
      price: { currency: "CNY", amountMinor: 1990 },
      availability: "unavailable",
      default: false,
    },
  ],
};

type ProductListMode = "normal" | "full-partial" | "short-partial" | "empty-partial";

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

interface ProductFixture {
  storeStatus: number;
  productListStatus: number;
  productDetailStatus: number;
  productListMode: ProductListMode;
  malformedProductList: boolean;
  malformedProductDetail: boolean;
  storeRequests: Request[];
  productListRequests: Request[];
  productDetailRequests: Request[];
  imageRequests: Request[];
  externalRequests: Request[];
  requestOrder: string[];
  holdNextStoreDetail(): void;
  releaseStoreDetail(): void;
}

function requestId(sequence: number) {
  return `10000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
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

function productListBody(mode: ProductListMode, malformed: boolean) {
  let items: Record<string, unknown>[];
  let total: number;
  let hasMore: boolean;

  if (mode === "full-partial") {
    items = Array.from({ length: 20 }, (_, index) => product(String(index + 10)));
    total = 21;
    hasMore = true;
  } else if (mode === "short-partial") {
    items = [product("10"), product("11")];
    total = 21;
    hasMore = true;
  } else if (mode === "empty-partial") {
    items = [];
    total = 21;
    hasMore = true;
  } else {
    items = [product("10"), product("11")];
    total = 2;
    hasMore = false;
  }

  if (malformed && items[0]) items[0] = { ...items[0], internalCost: 1 };
  return { items, page: { page: 1, pageSize: 20, total, hasMore } };
}

async function installProductFixture(page: Page): Promise<ProductFixture> {
  let sequence = 0;
  let storeGate: Deferred<void> | null = null;
  const state: ProductFixture = {
    storeStatus: 200,
    productListStatus: 200,
    productDetailStatus: 200,
    productListMode: "normal",
    malformedProductList: false,
    malformedProductDetail: false,
    storeRequests: [],
    productListRequests: [],
    productDetailRequests: [],
    imageRequests: [],
    externalRequests: [],
    requestOrder: [],
    holdNextStoreDetail() {
      storeGate = deferred<void>();
    },
    releaseStoreDetail() {
      storeGate?.resolve();
    },
  };

  page.on("request", (request) => {
    const url = new URL(request.url());
    if (request.resourceType() === "image") state.imageRequests.push(request);
    if (url.hostname === "hostile-commerce.invalid") state.externalRequests.push(request);
  });

  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path === "/api/commerce/stores/1") {
      state.storeRequests.push(request);
      state.requestOrder.push("store:1");
      const activeGate = storeGate;
      if (activeGate) {
        await activeGate.promise;
        if (storeGate === activeGate) storeGate = null;
      }
      if (state.storeStatus !== 200) {
        await route.fulfill({
          status: state.storeStatus,
          contentType: "application/json",
          body: "{}",
        });
        return;
      }
      sequence += 1;
      await commerceJson(route, { store: STORE }, sequence);
      return;
    }

    if (path === "/api/commerce/stores/1/products") {
      state.productListRequests.push(request);
      state.requestOrder.push("store-products:1");
      if (state.productListStatus !== 200) {
        await route.fulfill({
          status: state.productListStatus,
          contentType: "application/json",
          body: "{}",
        });
        return;
      }
      sequence += 1;
      await commerceJson(
        route,
        productListBody(state.productListMode, state.malformedProductList),
        sequence,
      );
      return;
    }

    if (path === "/api/commerce/products/10") {
      state.productDetailRequests.push(request);
      state.requestOrder.push("product:10");
      if (state.productDetailStatus !== 200) {
        await route.fulfill({
          status: state.productDetailStatus,
          contentType: "application/json",
          body: "{}",
        });
        return;
      }
      sequence += 1;
      const detail = state.malformedProductDetail
        ? { ...PRODUCT_DETAIL, upstreamHtml: "<b>unsafe</b>" }
        : PRODUCT_DETAIL;
      await commerceJson(route, { product: detail }, sequence);
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  return state;
}

function requestPath(request: Request) {
  const url = new URL(request.url());
  return `${url.pathname}${url.search}`;
}

async function assertProductRequestBoundary(request: Request, page: Page, expectedPath: string) {
  expect(requestPath(request)).toBe(expectedPath);
  expect(request.method()).toBe("GET");
  expect(request.postData()).toBeNull();
  expect(request.headers().accept).toContain("application/json");
  expect(request.headers()["x-client-id"]).toBeUndefined();
  expect(new URL(request.url()).origin).toBe(new URL(page.url()).origin);
}

test.describe("@local-commerce anonymous product-read journeys", () => {
  test.beforeAll(() => {
    expect(process.env.VITE_COMMERCE_CATALOG_VISIBLE).toBe("true");
    expect(process.env.VITE_COMMERCE_PRODUCT_VISIBLE).toBe("true");
  });

  test("waits for store success, then follows real product/detail/back anchors with cold refresh", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Reflect.set(window, "LIAN_API_BASE_URL", "https://hostile-commerce.invalid/private");
    });
    const fixture = await installProductFixture(page);
    fixture.holdNextStoreDetail();

    await page.goto("/#/commerce/stores/1");
    await expect.poll(() => fixture.requestOrder).toEqual(["store:1"]);
    await page.waitForTimeout(50);
    expect(fixture.productListRequests).toHaveLength(0);

    fixture.releaseStoreDetail();
    await expect(page.getByTestId("commerce-products-section")).toBeVisible();
    await expect(page.getByTestId("commerce-product-card-10")).toBeVisible();
    await expect(page.getByTestId("commerce-product-discovery-notice")).toContainText("不代表报价");
    await expect(page.getByTestId("commerce-product-discovery-notice")).toContainText("库存预留");
    expect(fixture.requestOrder).toEqual(["store:1", "store-products:1"]);
    await assertProductRequestBoundary(
      fixture.productListRequests[0],
      page,
      "/api/commerce/stores/1/products",
    );

    const productAnchor = page.getByTestId("commerce-product-card-10").locator("a");
    await expect(productAnchor).toHaveAttribute("href", "#/commerce/products/10");
    await productAnchor.click();
    const detailPage = page.getByTestId("commerce-product-detail-page");
    await expect(detailPage).toContainText("校园商品 10");
    await expect(detailPage).toContainText("仅供浏览");
    await expect(detailPage).toContainText("不代表报价");
    await expect(detailPage).toContainText("库存预留");
    await expect(detailPage.getByTestId("commerce-product-cover-placeholder")).toBeVisible();
    await assertProductRequestBoundary(
      fixture.productDetailRequests[0],
      page,
      "/api/commerce/products/10",
    );

    const returnAnchor = detailPage.locator('a[href="#/commerce/stores/1"]');
    await expect(returnAnchor).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("commerce-product-detail-page")).toContainText("校园商品 10");
    expect(fixture.productDetailRequests).toHaveLength(2);

    await page
      .getByTestId("commerce-product-detail-page")
      .locator('a[href="#/commerce/stores/1"]')
      .click();
    await expect(page.getByTestId("commerce-detail-page")).toContainText(STORE.name);
    await expect(page.getByTestId("commerce-products-section")).toBeVisible();
    expect(fixture.requestOrder.slice(-2)).toEqual(["store:1", "store-products:1"]);

    await expect(page.locator(".commerce-view img, .commerce-view picture")).toHaveCount(0);
    expect(
      fixture.imageRequests.filter((request) => {
        const path = new URL(request.url()).pathname.toLowerCase();
        return path.includes("commerce") || path.endsWith("/null") || path.endsWith("/undefined");
      }),
    ).toHaveLength(0);
    expect(fixture.externalRequests).toHaveLength(0);
  });

  test("shows a truthful partial-catalog notice for full, short, and empty hasMore pages", async ({
    page,
  }) => {
    const fixture = await installProductFixture(page);

    fixture.productListMode = "full-partial";
    await page.goto("/#/commerce/stores/1");
    await expect(page.locator(".commerce-product-card")).toHaveCount(20);
    await expect(page.getByTestId("commerce-product-partial")).toBeVisible();
    await expect(page.getByTestId("commerce-product-partial")).toContainText("仅展示部分商品");

    fixture.productListMode = "short-partial";
    await page.reload();
    await expect(page.locator(".commerce-product-card")).toHaveCount(2);
    await expect(page.getByTestId("commerce-product-partial")).toBeVisible();

    fixture.productListMode = "empty-partial";
    await page.reload();
    await expect(page.getByTestId("commerce-product-empty")).toBeVisible();
    await expect(page.getByTestId("commerce-product-partial")).toBeVisible();
    await expect(page.getByTestId("commerce-product-partial")).not.toContainText("20 件");
    await expect(page.getByTestId("commerce-product-partial").locator("button, a")).toHaveCount(0);
    expect(fixture.productListRequests).toHaveLength(3);
  });

  test("keeps list 404, 429, 504, malformed, and empty results in safe local states", async ({
    page,
  }) => {
    const fixture = await installProductFixture(page);

    fixture.storeStatus = 404;
    await page.goto("/#/commerce/stores/1");
    await expect(page.getByTestId("commerce-not-found")).toBeVisible();
    expect(fixture.productListRequests).toHaveLength(0);

    fixture.storeStatus = 200;
    fixture.productListStatus = 404;
    await page.reload();
    await expect(page.getByTestId("commerce-product-not-found")).toBeVisible();

    fixture.productListStatus = 429;
    await page.reload();
    await expect(page.getByTestId("commerce-product-error")).toContainText("频繁");

    fixture.productListStatus = 504;
    await page.reload();
    await expect(page.getByTestId("commerce-product-error")).toContainText("超时");

    fixture.productListStatus = 200;
    fixture.malformedProductList = true;
    await page.reload();
    await expect(page.getByTestId("commerce-product-error")).toBeVisible();
    await expect(page.getByTestId("commerce-products-section")).not.toContainText("internalCost");

    fixture.malformedProductList = false;
    fixture.productListMode = "empty-partial";
    await page.reload();
    await expect(page.getByTestId("commerce-product-empty")).toBeVisible();
  });

  test("keeps product-detail 404 and 429 retry states local", async ({ page }) => {
    const fixture = await installProductFixture(page);

    fixture.productDetailStatus = 404;
    await page.goto("/#/commerce/products/10");
    await expect(page.getByTestId("commerce-product-not-found")).toBeVisible();

    fixture.productDetailStatus = 429;
    await page.reload();
    await expect(page.getByTestId("commerce-product-error")).toContainText("频繁");

    fixture.productDetailStatus = 200;
    await page.getByRole("button", { name: "重新加载" }).click();
    await expect(page.getByTestId("commerce-product-detail-page")).toContainText("校园商品 10");
  });

  test("keeps product-detail 504 and malformed responses local and non-leaking", async ({
    page,
  }) => {
    const fixture = await installProductFixture(page);

    fixture.productDetailStatus = 504;
    await page.goto("/#/commerce/products/10");
    await expect(page.getByTestId("commerce-product-error")).toContainText("超时");

    fixture.productDetailStatus = 200;
    fixture.malformedProductDetail = true;
    await page.reload();
    await expect(page.getByTestId("commerce-product-error")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("upstreamHtml");
    await expect(page.locator("body")).not.toContainText("unsafe");
  });
});
