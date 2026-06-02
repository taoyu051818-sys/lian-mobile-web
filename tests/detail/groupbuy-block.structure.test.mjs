import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

test("GroupbuyComponentV2 extends the V2 component contract", () => {
  const src = read("src/types/post-extensions.ts");
  assert.match(src, /\| "groupbuy"/);
  assert.match(src, /export type GroupbuyState\s*=/);
  assert.match(src, /export interface GroupbuyComponentV2\s*{/);
  for (const field of [
    "groupbuyId",
    "state",
    "participantCount",
    "targetCount",
    "channelId",
    "joined",
  ]) {
    assert.match(src, new RegExp(`${field}\\?:`));
  }
  assert.match(src, /\| GroupbuyComponentV2/);
});

test("PostDetailGroupbuyBlock renders participation, channel entry, and unknown state fallback", () => {
  const src = read("src/features/detail/PostDetailGroupbuyBlock.vue");
  assert.match(src, /data-testid="post-detail-groupbuy-block"/);
  assert.match(src, /data-testid="post-detail-groupbuy-participants"/);
  assert.match(src, /data-testid="post-detail-groupbuy-channel"/);
  assert.match(src, /data-testid="post-detail-groupbuy-join"/);
  assert.match(
    src,
    /STATE_LABEL\[stateValue\.value\] \?\? `\$\{GROUPBUY_STATE_UNKNOWN_PREFIX\}：\$\{stateValue\.value\}`/,
  );
  assert.match(src, /GROUPBUY_SETTLEMENT_HINT/);
});

test("post component registry mounts the group-buy detail renderer by default", () => {
  const src = read("src/features/detail/postComponentRegistry.ts");
  assert.match(src, /import PostDetailGroupbuyBlock from "\.\/PostDetailGroupbuyBlock\.vue"/);
  assert.match(src, /registry\.set\("groupbuy", \{ component: PostDetailGroupbuyBlock \}\)/);
});
