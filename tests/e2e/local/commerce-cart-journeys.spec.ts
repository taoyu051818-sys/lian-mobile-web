import { expect, test } from "@playwright/test";
import {
  createServer,
  request as requestUpstream,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const PRODUCT = {
  id: "10",
  storeId: "1",
  name: "校园帆布包",
  subtitle: "适合日常校园生活",
  coverAssetRef: null,
  priceRange: { currency: "CNY", minAmountMinor: 1290, maxAmountMinor: 1590 },
  availability: "available",
  rating: "4.80",
  salesCount: 12,
  recommended: true,
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
      name: "暂停售",
      price: { currency: "CNY", amountMinor: 1990 },
      availability: "unavailable",
      default: false,
    },
  ],
};

interface RecordedRequest {
  method: string;
  path: string;
  headers: IncomingHttpHeaders;
  body: string;
}

interface CartFixture {
  origin: string;
  writes: RecordedRequest[];
  actorRequests: RecordedRequest[];
  close(): Promise<void>;
}

function requestId(sequence: number) {
  return `20000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
}

function strictSuccess(response: ServerResponse, data: unknown, sequence: number) {
  const id = requestId(sequence);
  response.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Request-Id": id,
  });
  response.end(JSON.stringify({ data, meta: { requestId: id, schemaVersion: "1.0.0" } }));
}

function strictError(
  response: ServerResponse,
  status: number,
  error: string,
  code: string,
  sequence: number,
) {
  const id = requestId(sequence);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Request-Id": id,
  });
  response.end(JSON.stringify({ error, code, requestId: id }));
}

function cartItem(quantity: number) {
  return {
    skuId: "100",
    productId: "10",
    storeId: "1",
    productName: PRODUCT.name,
    skuName: "标准装",
    quantity,
    referenceUnitPrice: { currency: "CNY", amountMinor: 1290 },
    availability: "available",
  };
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

async function startCartFixture(upstreamOrigin: string): Promise<CartFixture> {
  let sequence = 0;
  let actorInitialized = false;
  let quantity = 0;
  const writes: RecordedRequest[] = [];
  const actorRequests: RecordedRequest[] = [];

  const server = createServer((request, response) => {
    void (async () => {
      const path = new URL(request.url ?? "/", "http://fixture.invalid").pathname;
      const method = request.method ?? "GET";
      if (!path.startsWith("/api/")) {
        const target = new URL(request.url ?? "/", upstreamOrigin);
        const upstream = requestUpstream(
          target,
          { method, headers: { ...request.headers, host: target.host } },
          (upstreamResponse) => {
            response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
            upstreamResponse.pipe(response);
          },
        );
        upstream.on("error", () => {
          if (!response.headersSent) response.writeHead(502);
          response.end();
        });
        request.pipe(upstream);
        return;
      }

      const body = await readBody(request);
      const recorded = { method, path, headers: request.headers, body };
      if (path === "/api/commerce/products/10" && method === "GET") {
        sequence += 1;
        strictSuccess(response, { product: PRODUCT }, sequence);
        return;
      }
      if (path === "/api/commerce/cart" && method === "GET") {
        sequence += 1;
        strictSuccess(
          response,
          { cart: { items: quantity === 0 ? [] : [cartItem(quantity)] } },
          sequence,
        );
        return;
      }
      if (path === "/api/commerce/actors/me" && method === "PUT") {
        writes.push(recorded);
        actorRequests.push(recorded);
        actorInitialized = true;
        sequence += 1;
        strictSuccess(response, { actor: { initialized: true } }, sequence);
        return;
      }
      if (path === "/api/commerce/cart/items/100" && method === "PUT") {
        writes.push(recorded);
        sequence += 1;
        if (!actorInitialized) {
          strictError(
            response,
            409,
            "Commerce actor initialization is required",
            "COMMERCE_ACTOR_INITIALIZATION_REQUIRED",
            sequence,
          );
          return;
        }
        quantity = Number((JSON.parse(body) as { quantity: number }).quantity);
        strictSuccess(response, { cart: { items: [cartItem(quantity)] } }, sequence);
        return;
      }
      if (path === "/api/commerce/cart/items/100" && method === "DELETE") {
        writes.push(recorded);
        quantity = 0;
        sequence += 1;
        strictSuccess(response, { cart: { items: [] } }, sequence);
        return;
      }
      response.writeHead(path.startsWith("/api/commerce/") ? 404 : 200, {
        "Content-Type": "application/json",
      });
      response.end(path.startsWith("/api/commerce/") ? '{"error":"not found"}' : "{}");
    })().catch(() => {
      if (!response.headersSent) response.writeHead(500);
      response.end();
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${address.port}`,
    writes,
    actorRequests,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
}

function assertWriteBoundary(request: RecordedRequest, expectedBody: string, origin: string) {
  expect(request.headers.origin).toBe(origin);
  expect(request.headers["sec-fetch-site"]).toBe("same-origin");
  expect(request.headers["content-type"]).toBe("application/json");
  expect(request.headers["x-lian-csrf"]).toBe("1");
  expect(request.headers["idempotency-key"]).toMatch(UUID_V4);
  expect(request.headers["x-client-id"]).toBeUndefined();
  expect(request.headers.cookie).toContain("commerce_e2e_session=present");
  expect(request.body).toBe(expectedBody);
}

test.describe("@local-commerce authenticated cart MVP", () => {
  test.beforeAll(() => {
    expect(process.env.VITE_COMMERCE_CATALOG_VISIBLE).toBe("true");
    expect(process.env.VITE_COMMERCE_PRODUCT_VISIBLE).toBe("true");
    expect(process.env.VITE_COMMERCE_CART_VISIBLE).toBe("true");
  });

  test("selects, initializes once, adopts cart writes, deletes, and cold-refreshes", async ({
    page,
    baseURL,
  }) => {
    if (!baseURL) throw new Error("local commerce cart journey requires baseURL");
    const fixture = await startCartFixture(baseURL);
    try {
      await page
        .context()
        .addCookies([{ name: "commerce_e2e_session", value: "present", url: fixture.origin }]);
      await page.goto(`${fixture.origin}/#/commerce/products/10`);
      const detail = page.getByTestId("commerce-product-detail-page");
      await expect(detail).toContainText(PRODUCT.name);
      await expect(detail.locator('input[value="100"]')).toBeChecked();
      await expect(detail.locator('input[value="102"]')).toBeDisabled();
      await detail.getByTestId("commerce-add-to-cart").click();
      await expect(detail.getByTestId("commerce-add-success")).toBeVisible();

      expect(fixture.actorRequests).toHaveLength(1);
      expect(fixture.writes.map((request) => request.method)).toEqual(["PUT", "PUT", "PUT"]);
      expect(fixture.writes.map((request) => request.path)).toEqual([
        "/api/commerce/cart/items/100",
        "/api/commerce/actors/me",
        "/api/commerce/cart/items/100",
      ]);

      await detail.locator('a[href="#/commerce/cart"]').click();
      const cart = page.getByTestId("commerce-cart-page");
      const row = cart.getByTestId("commerce-cart-item-100");
      await expect(row).toContainText("数量 1");
      await row.getByRole("button", { name: "增加一件" }).click();
      await expect(row).toContainText("数量 2");
      await row.getByRole("button", { name: "移除" }).click();
      await expect(cart.getByTestId("commerce-cart-empty")).toBeVisible();
      await page.reload();
      await expect(cart.getByTestId("commerce-cart-empty")).toBeVisible();

      expect(fixture.writes).toHaveLength(5);
      const expectedBodies = ['{"quantity":1}', "{}", '{"quantity":1}', '{"quantity":2}', "{}"];
      fixture.writes.forEach((request, index) =>
        assertWriteBoundary(request, expectedBodies[index] ?? "", fixture.origin),
      );
      expect(
        new Set(fixture.writes.map((request) => request.headers["idempotency-key"])).size,
      ).toBe(fixture.writes.length);
      expect(fixture.actorRequests).toHaveLength(1);
    } finally {
      await fixture.close();
    }
  });
});
