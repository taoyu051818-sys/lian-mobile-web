import { describe, it, expect } from "vitest";
import { parseDeepLinkQuery, buildMapPickerHash } from "../../src/app/deepLink";

describe("parseDeepLinkQuery", () => {
  it("returns an empty object for null/undefined/empty input", () => {
    expect(parseDeepLinkQuery(null)).toEqual({});
    expect(parseDeepLinkQuery(undefined)).toEqual({});
    expect(parseDeepLinkQuery("")).toEqual({});
  });

  it("returns an empty object when the hash has no query segment", () => {
    expect(parseDeepLinkQuery("#/map")).toEqual({});
    expect(parseDeepLinkQuery("#/publish")).toEqual({});
    expect(parseDeepLinkQuery("/map/")).toEqual({});
    expect(parseDeepLinkQuery("#/post/42")).toEqual({});
  });

  it("parses a single key=value query into a flat record", () => {
    expect(parseDeepLinkQuery("#/map?picker=1")).toEqual({ picker: "1" });
    expect(parseDeepLinkQuery("/map?picker=1")).toEqual({ picker: "1" });
  });

  it("parses multiple keys", () => {
    expect(parseDeepLinkQuery("#/map?picker=1&ref=publish")).toEqual({
      picker: "1",
      ref: "publish",
    });
  });

  it("first occurrence wins for duplicate keys", () => {
    expect(parseDeepLinkQuery("#/map?picker=1&picker=2")).toEqual({ picker: "1" });
  });

  it("strips a trailing fragment from the query tail", () => {
    expect(parseDeepLinkQuery("#/map?picker=1#section")).toEqual({ picker: "1" });
  });

  it("returns an empty object when the query segment is empty", () => {
    expect(parseDeepLinkQuery("#/map?")).toEqual({});
  });

  it("decodes URL-encoded values", () => {
    expect(parseDeepLinkQuery("#/map?label=hello%20world&kind=place")).toEqual({
      label: "hello world",
      kind: "place",
    });
  });
});

describe("buildMapPickerHash", () => {
  it("emits the canonical picker URL", () => {
    expect(buildMapPickerHash()).toBe("#/map?picker=1");
  });

  it("round-trips through parseDeepLinkQuery", () => {
    expect(parseDeepLinkQuery(buildMapPickerHash()).picker).toBe("1");
  });
});
