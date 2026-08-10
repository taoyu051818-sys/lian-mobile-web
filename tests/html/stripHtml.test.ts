import { describe, expect, it } from "vitest";
import { stripHtml } from "../../src/utils/html";

describe("stripHtml", () => {
  it("keeps readable text and collapses markup whitespace", () => {
    expect(stripHtml("<p>Hello <strong>LIAN</strong></p><p>Welcome</p>")).toBe(
      "Hello LIAN Welcome",
    );
  });

  it("decodes common and numeric HTML entities", () => {
    expect(stripHtml("A&nbsp;&amp;&#32;B&#x21;")).toBe("A & B!");
  });

  it("drops unsafe block contents through the sanitizer boundary", () => {
    expect(stripHtml("<p>safe</p><script>alert(1)</script>")).toBe("safe");
  });
});
