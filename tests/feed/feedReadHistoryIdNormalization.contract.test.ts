import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeFeedItemId } from "../../src/features/feed/feedItemId";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const feedDataSource = fs.readFileSync(
  path.join(repoRoot, "src/features/feed/useFeedData.ts"),
  "utf8",
);
const feedDetailSource = fs.readFileSync(
  path.join(repoRoot, "src/features/feed/useFeedDetail.ts"),
  "utf8",
);
const browserStorageSource = fs.readFileSync(
  path.join(repoRoot, "src/platform/browser-storage.ts"),
  "utf8",
);

describe("Feed read-history string id normalization", () => {
  it("normalizes numeric and string ids through one shared helper", () => {
    expect(normalizeFeedItemId(123)).toBe("123");
    expect(normalizeFeedItemId("123")).toBe("123");
    expect(normalizeFeedItemId(0)).toBe("0");
    expect(normalizeFeedItemId(null)).toBe("");
    expect(normalizeFeedItemId(undefined)).toBe("");
  });

  it("useFeedData delegates read history to platform/browser-storage", () => {
    expect(feedDataSource).toMatch(
      /import \{.*readHistoryQuery.*rememberReadItem.*\} from "\.\.\/\.\.\/platform\/browser-storage"/,
    );
    expect(feedDataSource).not.toMatch(/localStorage\.getItem/);
  });

  it("browser-storage normalizes TIDs in readHistoryQuery and rememberReadItem", () => {
    expect(browserStorageSource).toMatch(/String\(entry\.tid\)/);
    expect(browserStorageSource).toMatch(/const normalizedId = id == null \? "" : String\(id\)/);
    expect(browserStorageSource).toMatch(/String\(entry\.tid\) !== normalizedId/);
  });

  it("reuses the helper in detail guard paths", () => {
    expect(feedDetailSource).toMatch(/import \{ normalizeFeedItemId \} from "\.\/feedItemId";/);
    expect(feedDetailSource).toMatch(/const normalizedId = normalizeFeedItemId\(id\);/);
    expect(feedDetailSource).toMatch(
      /normalizeFeedItemId\(selectedPostId\.value\) === normalizedId/,
    );
    expect(feedDetailSource).not.toMatch(/Number\(selectedPostId\.value\) === Number\(id\)/);
  });
});
