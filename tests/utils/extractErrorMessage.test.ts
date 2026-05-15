import { describe, it, expect } from "vitest";
import { extractErrorMessage } from "../../src/utils/extractErrorMessage";

describe("extractErrorMessage", () => {
  it("returns error.message when error is an Error instance", () => {
    expect(extractErrorMessage(new Error("网络超时"), "fallback")).toBe("网络超时");
  });

  it("returns fallback when error is a string", () => {
    expect(extractErrorMessage("unknown", "fallback")).toBe("fallback");
  });

  it("returns fallback when error is null", () => {
    expect(extractErrorMessage(null, "fallback")).toBe("fallback");
  });

  it("returns fallback when error is undefined", () => {
    expect(extractErrorMessage(undefined, "fallback")).toBe("fallback");
  });

  it("returns fallback when error is a number", () => {
    expect(extractErrorMessage(42, "fallback")).toBe("fallback");
  });

  it("returns fallback when error is an object without message", () => {
    expect(extractErrorMessage({ code: 1 }, "fallback")).toBe("fallback");
  });
});
