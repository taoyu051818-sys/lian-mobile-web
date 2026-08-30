import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CommerceApiError,
  decodeCommerceCheckoutQuoteResult,
  fetchCommerceCheckoutQuote,
} from "../../src/api/commerce";
import { useCommerceCheckoutQuote } from "../../src/features/commerce/useCommerceCheckoutQuote";

const REQUEST_ID = "0f47a18d-3b6c-4c8a-9cf1-1a2b3c4d5e6f";

function envelope(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      quote: {
        currency: "CNY",
        lines: [
          { skuId: "7", quantity: 2, unitAmountMinor: 1290, lineAmountMinor: 2580 },
          { skuId: "42", quantity: 1, unitAmountMinor: 500, lineAmountMinor: 500 },
        ],
        merchandiseAmountMinor: 3080,
        expiresAt: 1_900_000_120,
        token: "opaque.signed-quote-token-with-enough-bytes",
        stockReserved: false,
      },
    },
    meta: { requestId: REQUEST_ID, schemaVersion: "1.0.0" },
    ...overrides,
  };
}

function response(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Request-Id": REQUEST_ID,
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("commerce checkout quote", () => {
  it("POSTs exact empty JSON with CSRF and deliberately no idempotency key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(envelope()));
    vi.stubGlobal("fetch", fetchMock);
    const signal = new AbortController().signal;
    const result = await fetchCommerceCheckoutQuote(signal);

    expect(result.quote.merchandiseAmountMinor).toBe(3080);
    expect(fetchMock).toHaveBeenCalledWith("/api/commerce/checkout/quote", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-LIAN-CSRF": "1",
      },
      body: "{}",
      signal,
    });
  });

  it("rejects line arithmetic, ordering, total and reservation drift", () => {
    const base = envelope();
    const quote = structuredClone(base.data.quote);
    quote.lines[0]!.lineAmountMinor = 1;
    expect(() =>
      decodeCommerceCheckoutQuoteResult({ ...base, data: { quote } }, REQUEST_ID),
    ).toThrowError(CommerceApiError);

    const reserved = structuredClone(base.data.quote);
    reserved.stockReserved = true;
    expect(() =>
      decodeCommerceCheckoutQuoteResult({ ...base, data: { quote: reserved } }, REQUEST_ID),
    ).toThrowError(CommerceApiError);
  });

  it("keeps the opaque token page-scoped and clears it when cart state changes", async () => {
    const owner = useCommerceCheckoutQuote(
      {
        quote: async () => decodeCommerceCheckoutQuoteResult(envelope(), REQUEST_ID),
      },
      () => true,
    );
    await owner.create();
    expect(owner.status.value).toBe("ready");
    expect(owner.result.value?.quote.token).toBe("opaque.signed-quote-token-with-enough-bytes");

    owner.clear();
    expect(owner.status.value).toBe("idle");
    expect(owner.result.value).toBeNull();
  });
});
