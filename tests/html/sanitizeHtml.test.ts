import { describe, it, expect } from "vitest";
import { sanitizeHtml, stripHtml } from "../../src/utils/html";

describe("sanitizeHtml", () => {
  it("returns empty string for falsy input", () => {
    expect(sanitizeHtml("")).toBe("");
    expect(sanitizeHtml(null as unknown as string)).toBe("");
    expect(sanitizeHtml(undefined as unknown as string)).toBe("");
  });

  it("strips script tags and their content", () => {
    expect(sanitizeHtml('<p>safe</p><script>alert("xss")</script>')).toBe("<p>safe</p>");
  });

  it("strips style tags and their content", () => {
    expect(sanitizeHtml("<p>text</p><style>body{color:red}</style>")).toBe("<p>text</p>");
  });

  it("strips iframe tags", () => {
    expect(sanitizeHtml('<p>text</p><iframe src="https://evil.com"></iframe>')).toBe("<p>text</p>");
  });

  it("strips HTML comments", () => {
    expect(sanitizeHtml("<p>text</p><!-- comment -->")).toBe("<p>text</p>");
  });

  it("strips inline event handlers", () => {
    expect(sanitizeHtml('<img src="x" onerror="alert(1)">')).toBe('<img src="x">');
  });

  it("strips style attributes", () => {
    expect(sanitizeHtml('<p style="color:red">text</p>')).toBe("<p>text</p>");
  });

  it("strips javascript: href values", () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">link</a>')).toBe("<a>link</a>");
  });

  it("strips javascript: src values", () => {
    expect(sanitizeHtml('<img src="javascript:alert(1)">')).toBe("<img>");
  });

  it("preserves safe HTML structure", () => {
    const input = '<p>Hello <strong>world</strong></p><a href="https://example.com">link</a>';
    expect(sanitizeHtml(input)).toBe(input);
  });
});

describe("stripHtml", () => {
  it("returns empty string for falsy input", () => {
    expect(stripHtml("")).toBe("");
    expect(stripHtml(null as unknown as string)).toBe("");
  });

  it("strips all tags and preserves text content", () => {
    expect(stripHtml("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
  });

  it("normalizes whitespace", () => {
    expect(stripHtml("<p>  hello   world  </p>")).toBe("hello world");
  });

  it("handles nested tags", () => {
    expect(stripHtml("<div><p><span>deep</span></p></div>")).toBe("deep");
  });

  it("strips tags but preserves text content between them", () => {
    expect(stripHtml('<p>safe</p><script>alert("xss")</script>')).toBe('safealert("xss")');
  });
});
