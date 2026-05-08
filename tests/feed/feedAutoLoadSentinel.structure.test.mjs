import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const feedViewSource = fs.readFileSync(path.join(repoRoot, "src/views/FeedView.vue"), "utf8");
const sentinelSource = fs.readFileSync(path.join(repoRoot, "src/composables/useAutoLoadSentinel.ts"), "utf8");

test("FeedView owns the auto-load sentinel wiring", () => {
  assert.match(feedViewSource, /import \{ useAutoLoadSentinel \} from "\.\.\/composables\/useAutoLoadSentinel";/);
  assert.match(feedViewSource, /const loadMoreSentinelRef = ref<HTMLElement \| null>\(null\);/);
  assert.match(feedViewSource, /function triggerLoadMore\(\) \{/);
  assert.match(feedViewSource, /if \(!canAutoLoadMore\.value\) return;/);
  assert.match(feedViewSource, /void loadFeed\(false\);/);
  assert.match(feedViewSource, /useAutoLoadSentinel\(loadMoreSentinelRef, triggerLoadMore, \{/);
  assert.match(feedViewSource, /enabled: \(\) => canAutoLoadMore\.value,/);
  assert.match(feedViewSource, /rootMargin: "720px 0px 720px 0px",/);
  assert.match(feedViewSource, /cooldownMs: 900,/);
  assert.match(feedViewSource, /ref="loadMoreSentinelRef"/);
  assert.match(feedViewSource, /class="feed-view__load-more-sentinel"/);
});

test("the shared sentinel composable keeps observer setup and cleanup explicit", () => {
  assert.match(sentinelSource, /let observer: IntersectionObserver \| null = null;/);
  assert.match(sentinelSource, /function disconnect\(\) \{/);
  assert.match(sentinelSource, /observer\?\.disconnect\(\);/);
  assert.match(sentinelSource, /function observeTarget\(target: HTMLElement \| null\) \{/);
  assert.match(sentinelSource, /if \(!target \|\| typeof IntersectionObserver === "undefined"\) return;/);
  assert.match(sentinelSource, /observer = new IntersectionObserver/);
  assert.match(sentinelSource, /observer\.observe\(target\);/);
  assert.match(sentinelSource, /stopWatchingTarget = watch\(targetRef,/);
  assert.match(sentinelSource, /onBeforeUnmount\(\(\) => \{/);
  assert.match(sentinelSource, /stopWatchingTarget\?\.\(\);/);
  assert.match(sentinelSource, /disconnect\(\);/);
});