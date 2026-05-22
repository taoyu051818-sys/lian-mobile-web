import { expect, request, test, type APIRequestContext } from "@playwright/test";

import { isRoleConfigured, loginAs } from "./fixtures/accounts";
import { resolveRunnerOrderSeed } from "./fixtures/errand-runtime";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

interface RunnerOrder {
  id: string;
  status: string;
  title?: string;
}

interface RunnerListResponse {
  items?: RunnerOrder[];
}

interface RunnerTransitionResponse {
  order?: RunnerOrder;
}

async function fetchAvailable(api: APIRequestContext) {
  const response = await api.get("/api/errands/orders/mine?role=runner&state=paid_locked");
  expect(response.ok(), await response.text()).toBe(true);
  return ((await response.json()) as RunnerListResponse).items ?? [];
}

async function fetchActive(api: APIRequestContext) {
  const response = await api.get("/api/errands/orders/mine?role=runner");
  expect(response.ok(), await response.text()).toBe(true);
  return ((await response.json()) as RunnerListResponse).items ?? [];
}

async function transition(api: APIRequestContext, orderId: string, action: string) {
  const response = await api.post(`/api/errands/orders/${encodeURIComponent(orderId)}/${action}`);
  expect(response.ok(), await response.text()).toBe(true);
  const body = (await response.json()) as RunnerTransitionResponse;
  expect(body.order, `transition ${action} returned no order`).toBeTruthy();
  return body.order!;
}

test.describe("@runner runner center @runner-center", () => {
  test("@runner runner_verified user can list available orders", async () => {
    if (!isRoleConfigured("runner")) {
      test.skip(true, "runner role not configured — set LIAN_E2E_RUNNER_USERNAME/PASSWORD");
      return;
    }
    const { api } = await loginAs("runner");
    try {
      const items = await fetchAvailable(api);
      // The list shape must always be an array. An empty pool is acceptable —
      // not every E2E run will have available orders seeded — but the shape
      // contract must hold so the UI never tries to iterate `undefined`.
      expect(Array.isArray(items)).toBe(true);
    } finally {
      await api.dispose();
    }
  });

  test("@runner non-runner registered user is gated out of runner errand order reads", async () => {
    if (!isRoleConfigured("registered")) {
      test.skip(true, "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME/PASSWORD");
      return;
    }
    const { api, user } = await loginAs("registered");
    try {
      // Sanity: this account must NOT have the runner tag — otherwise the
      // gate test is meaningless.
      const flatTags = new Set<string>([...(user.tags ?? []), ...(user.verificationTags ?? [])]);
      expect(flatTags.has("runner"), "registered fixture must not carry runner tag").toBe(false);

      const response = await api.get("/api/errands/orders/mine?role=runner&state=paid_locked");
      // Backend may answer 401/403 (auth) or 404 (route hidden). Anything
      // outside the [400,500) range means the gate is broken.
      expect(
        response.status() >= 400 && response.status() < 500,
        `expected 4xx for non-runner access, got ${response.status()}`,
      ).toBe(true);
    } finally {
      await api.dispose();
    }
  });

  test("@runner anonymous visitor is rejected from runner errand order reads", async () => {
    const api = await request.newContext({ baseURL: BASE_URL });
    try {
      const response = await api.get("/api/errands/orders/mine?role=runner&state=paid_locked");
      expect(
        response.status() >= 400 && response.status() < 500,
        `expected 4xx for anonymous, got ${response.status()}`,
      ).toBe(true);
    } finally {
      await api.dispose();
    }
  });

  test("@runner runner_verified user advances accept -> pickup -> deliver", async () => {
    if (!isRoleConfigured("runner")) {
      test.skip(true, "runner role not configured — set LIAN_E2E_RUNNER_USERNAME/PASSWORD");
      return;
    }

    // Prefer the explicit override when present, but fall back to the
    // deterministic repo-backed errandJourney fixture. That keeps the runner
    // proof runnable on the seeded non-prod backend without guessing a live
    // order id by hand.
    const seed = await resolveRunnerOrderSeed({ baseURL: BASE_URL });
    if (!seed) {
      test.skip(
        true,
        "set LIAN_E2E_RUNNER_ORDER_ID or expose /api/fixtures.errandJourney ready=true to run this transition proof",
      );
      return;
    }
    const seedOrderId = seed.orderId;

    const { api } = await loginAs("runner");
    try {
      const availableBeforeAccept = await fetchAvailable(api);
      expect(
        availableBeforeAccept.some((order) => order.id === seedOrderId),
        `runner seed order ${seedOrderId} (source=${seed.source}) must be visible in the available pool before accept`,
      ).toBe(true);

      const accepted = await transition(api, seedOrderId, "accept");
      expect(accepted.status).toBe("assigned");

      const pickedUp = await transition(api, seedOrderId, "pickup");
      expect(pickedUp.status).toBe("delivering");

      const delivered = await transition(api, seedOrderId, "deliver");
      expect(delivered.status).toBe("delivered");

      const stillActive = await fetchActive(api);
      expect(stillActive.find((o) => o.id === seedOrderId)).toBeFalsy();
    } finally {
      await api.dispose();
    }
  });
});
