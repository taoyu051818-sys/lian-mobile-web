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
  path.join(repoRoot, "src/features/feed/usePostDetailLoader.ts"),
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

  it("loadDetail uses a request-token guard, not an id-equality guard", () => {
    // The id-equality guard regressed in PR #601 — anything that mutated
    // selectedPostId mid-flight (e.g. the new detailTid watch) caused the
    // finally branch to skip `detailLoading.value = false` and the panel
    // stayed stuck on "正在加载详情…". The token guard does not depend on
    // external state, so it cannot be broken that way.
    expect(feedDetailSource).toMatch(/let pendingToken = 0;/);
    expect(feedDetailSource).toMatch(/const token = \+\+pendingToken;/);
    expect(feedDetailSource).toMatch(/token !== pendingToken/);
    expect(feedDetailSource).toMatch(/token === pendingToken/);
    // The brittle id-equality guard must not return.
    expect(feedDetailSource).not.toMatch(
      /normalizeFeedItemId\(selectedPostId\.value\) === normalizedId/,
    );
    // resetLoaderState must invalidate any in-flight fetch so it does not
    // write back to the cleared state.
    expect(feedDetailSource).toMatch(/function resetLoaderState\(\) \{[\s\S]*?pendingToken/);
  });
});
