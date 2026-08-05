import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeFeedItem } from "../../src/api/feed";
import {
  FEED_RELATION_HINT_EVENT_REWARD,
  FEED_RELATION_HINT_GROUPBUY_CREATED,
  FEED_RELATION_HINT_GROUPBUY_JOINED,
  FEED_RELATION_HINT_HELP_EVENT,
  FEED_RELATION_HINT_MERCHANT_ERRAND,
  FEED_RELATION_HINT_PROJECT_SUBMISSION,
  FEED_RELATION_HINT_SOLUTION_EVENT,
  FEED_RELATION_HINT_TRADE_OFFER,
} from "../../src/config/brand";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const feedDataSource = fs.readFileSync(
  path.join(repoRoot, "src/features/feed/useFeedData.ts"),
  "utf8",
);
const feedCardSource = fs
  .readFileSync(path.join(repoRoot, "src/features/feed/FeedItemCard.vue"), "utf8")
  .replace(/\r\n/g, "\n");
const feedCardShellSource = fs
  .readFileSync(path.join(repoRoot, "src/features/feed/FeedItemCardShell.vue"), "utf8")
  .replace(/\r\n/g, "\n");
const detailStateSource = fs.readFileSync(
  path.join(repoRoot, "src/app/detail-navigation/state.ts"),
  "utf8",
);
const browserStorageSource = fs.readFileSync(
  path.join(repoRoot, "src/platform/browser-storage.ts"),
  "utf8",
);

describe("Feed read-history id normalization", () => {
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

  it("detail-navigation reducer uses a token guard, not an id-equality guard", () => {
    // The id-equality guard regressed in PR #601: anything that mutated
    // selectedPostId mid-flight (e.g. the deep-link watch) caused the finally
    // branch to skip clearing detailLoading and the panel stayed stuck on
    // "正在加载详情…". The reducer drops stale fetch-result actions whose
    // token does not match the current loading token — a check that does not
    // depend on any external state.
    expect(detailStateSource).toMatch(/token: number/);
    expect(detailStateSource).toMatch(/action\.token !== state\.token/);
    expect(detailStateSource).toMatch(/kind: "loading"/);
  });
});

describe("Feed relation hint chip", () => {
  it.each([
    ["help_event_link", FEED_RELATION_HINT_HELP_EVENT],
    ["trade_offer_link", FEED_RELATION_HINT_TRADE_OFFER],
    ["solution_event", FEED_RELATION_HINT_SOLUTION_EVENT],
    ["merchant_errand", FEED_RELATION_HINT_MERCHANT_ERRAND],
    ["project_submission", FEED_RELATION_HINT_PROJECT_SUBMISSION],
    ["event_reward", FEED_RELATION_HINT_EVENT_REWARD],
    ["groupbuy_joined", FEED_RELATION_HINT_GROUPBUY_JOINED],
    ["groupbuy_created", FEED_RELATION_HINT_GROUPBUY_CREATED],
  ])("maps %s to a brand label", (type, label) => {
    expect(label).toBeTruthy();
    expect(label).not.toBe(type);
    expect(feedCardSource).toContain(`${type}:`);
  });

  it("derives the displayed chip from relations[] and preserves the target tid", () => {
    expect(
      normalizeFeedItem({
        tid: 1000,
        relations: [{ type: "groupbuy_joined", target: { kind: "post", id: "2000" } }],
      })?.relationHint,
    ).toEqual({ type: "groupbuy_joined", targetTid: 2000 });
  });

  it("falls back to literal unknown relation types", () => {
    expect(feedCardSource).toMatch(
      /RELATION_HINT_LABELS\[item\.relationHint\.type\]\s*\?\?\s*item\.relationHint\.type/,
    );
    expect(
      normalizeFeedItem({
        tid: 1001,
        relations: [{ type: "custom_relation", target: { kind: "post", id: "2001" } }],
      })?.relationHint,
    ).toEqual({ type: "custom_relation", targetTid: 2001 });
  });

  it("renders no chip when relations are missing or empty", () => {
    expect(feedCardSource).toMatch(/const relationHint = item\.relationHint\s*\?/);
    expect(feedCardShellSource).toMatch(/v-if="relationHint"/);
    expect(normalizeFeedItem({ tid: 1002 })?.relationHint).toBeUndefined();
    expect(normalizeFeedItem({ tid: 1003, relations: [] })?.relationHint).toBeUndefined();
  });

  it("keeps the feed chip read-only", () => {
    expect(feedCardSource).not.toMatch(/@open-relation=/);
    expect(feedCardSource).not.toMatch(/function handleRelationOpen/);
    expect(feedCardShellSource).not.toMatch(/openRelation/);
    expect(feedCardShellSource).not.toMatch(/@click\.stop="openRelationHint"/);
    expect(feedCardShellSource).toMatch(/class="feed-item-card__relation-hint"/);
  });
});
