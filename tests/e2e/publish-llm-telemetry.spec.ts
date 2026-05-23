/**
 * PRD V0.2 §4.1 — RFC row S9 in `docs/agent/rfc/e2e-v02-prd-coverage.md`,
 * issue #878.
 *
 * Every LLM tick MUST record latency + model name on a publish-telemetry
 * sink. Failure ticks MUST log `status: "error"`. Stale-dropped responses
 * (in-flight ticket logic in `usePublishLlmTick.ts`) MUST NOT produce a
 * duplicate event.
 *
 * Status on `main` (2026-05-23): no publish-telemetry sink exists yet.
 * `usePublishLlmTick` succeeds / fails silently, with no
 * `window.__lianTelemetry` write. The RFC §9 Q2 follow-up tracks the sink
 * work — until that lands, the cases below cannot resolve their assertion
 * targets and the whole describe ships as `test.describe.fixme`. The spec
 * file itself is on `main` so the case scaffolding is in place for the
 * sink-wiring PR to flip back to `test.describe` once
 * `window.__lianTelemetry` is populated.
 *
 * Skip envelope: matches the wave-1 sibling specs —
 * `loginAs("registered")` requires LIAN_E2E_REGISTERED_USERNAME /
 * LIAN_E2E_REGISTERED_PASSWORD; without them the spec skips cleanly.
 * Missing seed is not a failure (see `[[project-e2e-secrets-state]]`).
 */

import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { isRoleConfigured, loginAs } from "./fixtures/accounts";

type CapturedTelemetryEvent = { name: string; payload: Record<string, unknown> };

/**
 * Pre-create `window.__lianTelemetry` as an empty array on every page in
 * the context. The spec body either reads back exactly the events the
 * sink fired, or — once the sink ships — confirms its absence is what
 * trips this fixme back to a real test.
 */
async function installTelemetryCapture(context: BrowserContext) {
  await context.addInitScript(() => {
    (window as unknown as { __lianTelemetry: unknown[] }).__lianTelemetry = [];
  });
}

async function readTelemetry(page: Page): Promise<CapturedTelemetryEvent[]> {
  return page.evaluate(() => {
    const captured = (window as unknown as { __lianTelemetry?: unknown[] }).__lianTelemetry;
    return (captured ?? []) as CapturedTelemetryEvent[];
  });
}

interface PreviewStubOptions {
  /** Force a non-2xx response (test the `status: "error"` branch). */
  status?: number;
  /** Override the latency value on the success payload. */
  latencyMs?: number;
  /** Override the model name on the success payload. */
  modelName?: string;
}

async function stubPostPreview(context: BrowserContext, options: PreviewStubOptions = {}) {
  await context.route("**/api/ai/post-preview", async (route) => {
    if (options.status && options.status >= 400) {
      await route.fulfill({
        status: options.status,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "stubbed-failure" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        mode: "mock",
        candidates: {
          title: null,
          bodyCandidate: null,
          suggestedComponents: [],
          inferredKind: null,
          modelLatencyMs: options.latencyMs ?? 5,
          modelName: options.modelName ?? "stub-model",
        },
      }),
    });
  });
}

async function typeTitleAndBody(page: Page, title: string, body: string) {
  await page.locator(".publish-composer__headline input").fill(title);
  await page.locator(".publish-composer__body-field textarea").fill(body);
}

test.describe
  .fixme("@registered publish §4.1 — LLM tick telemetry (sink missing on main, RFC §9 Q2 follow-up)", () => {
  test.beforeEach(() => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / _PASSWORD",
    );
  });

  test("successful tick emits exactly one publish_llm_tick event with status=ok", async ({
    browser,
  }) => {
    const { api } = await loginAs("registered");
    const context = await browser.newContext({ storageState: await api.storageState() });
    try {
      await installTelemetryCapture(context);
      await stubPostPreview(context, { latencyMs: 42, modelName: "stub-model" });
      const page = await context.newPage();
      await page.goto("/#/publish");
      await expect(page.locator(".publish-view")).toBeVisible();

      await typeTitleAndBody(page, "E2E telemetry ok", "Body for the telemetry-ok case.");

      // Wait past the 800ms debounce + a generous round-trip allowance.
      await expect
        .poll(async () => (await readTelemetry(page)).length, { timeout: 10_000 })
        .toBe(1);

      const events = await readTelemetry(page);
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe("publish_llm_tick");
      expect(events[0].payload.status).toBe("ok");
      expect(typeof events[0].payload.modelLatencyMs).toBe("number");
      expect(events[0].payload.modelName).toBe("stub-model");
    } finally {
      await context.close();
      await api.dispose();
    }
  });

  test("failed tick emits exactly one publish_llm_tick event with status=error", async ({
    browser,
  }) => {
    const { api } = await loginAs("registered");
    const context = await browser.newContext({ storageState: await api.storageState() });
    try {
      await installTelemetryCapture(context);
      await stubPostPreview(context, { status: 500 });
      const page = await context.newPage();
      await page.goto("/#/publish");
      await expect(page.locator(".publish-view")).toBeVisible();

      await typeTitleAndBody(page, "E2E telemetry err", "Body for the telemetry-error case.");

      await expect
        .poll(async () => (await readTelemetry(page)).length, { timeout: 10_000 })
        .toBe(1);

      const events = await readTelemetry(page);
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe("publish_llm_tick");
      expect(events[0].payload.status).toBe("error");
    } finally {
      await context.close();
      await api.dispose();
    }
  });

  test("stale-dropped response does not produce a duplicate publish_llm_tick event", async ({
    browser,
  }) => {
    const { api } = await loginAs("registered");
    const context = await browser.newContext({ storageState: await api.storageState() });
    try {
      await installTelemetryCapture(context);

      // Trickle a slow first response then a fast second response. The
      // slow one is superseded by the fast one (`inflight` ticket in
      // `usePublishLlmTick.ts`); the stale-response gate drops it on
      // arrival so only the fast one should land on the sink.
      let serial = 0;
      await context.route("**/api/ai/post-preview", async (route) => {
        serial += 1;
        const isFirst = serial === 1;
        if (isFirst) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            mode: "mock",
            candidates: {
              title: null,
              bodyCandidate: null,
              suggestedComponents: [],
              inferredKind: null,
              modelLatencyMs: isFirst ? 1200 : 5,
              modelName: "stub-model",
            },
          }),
        });
      });

      const page = await context.newPage();
      await page.goto("/#/publish");
      await expect(page.locator(".publish-view")).toBeVisible();

      await typeTitleAndBody(page, "stale tick", "First body to drive the slow tick.");
      // Let the first tick fire (debounce 800ms) but NOT settle yet.
      await page.waitForTimeout(900);

      await typeTitleAndBody(page, "stale tick v2", "Second body to drive the fast tick.");
      // Let the second tick fire + settle, plus enough room for the
      // first response to land late and be dropped.
      await page.waitForTimeout(2_000);

      const ticks = (await readTelemetry(page)).filter((e) => e.name === "publish_llm_tick");
      // Exactly one tick — the second/fast one. The stale first response
      // must NOT have produced a sink event; that's the contract.
      expect(ticks).toHaveLength(1);
    } finally {
      await context.close();
      await api.dispose();
    }
  });
});
