/**
 * PRD V0.3 §2.4 / B3-1 — PostDetailActionsBlock structure tests.
 *
 * Source-text contract test (same convention as
 * `post-detail-relations-block.test.ts` and the rest of the repo). Pins:
 *
 *   1. Empty / missing actions renders nothing (v-if on the section).
 *   2. Known action types map to brand strings; unknown types fall back to
 *      the literal `type`.
 *   3. `enabled === false` produces a disabled button with `title` carrying
 *      `reasonText || reason`. `enabled === undefined` defaults to enabled.
 *   4. Clicks emit `actionInvoked(type)` only — no RPC handler in this PR.
 *   5. The renderer doesn't reach for author / alias / user identity fields
 *      (anonymous-safety, even though actions don't carry identity today).
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  AVAILABLE_ACTIONS_BLOCK_LABEL,
  AVAILABLE_ACTION_APPROVE_SUBMISSION,
  AVAILABLE_ACTION_CLAIM_REWARD,
  AVAILABLE_ACTION_COMPLETE_ERRAND,
  AVAILABLE_ACTION_MARK_SOLVED,
  AVAILABLE_ACTION_OPEN_SUBMISSION,
  AVAILABLE_ACTION_REQUEST_REVIEW,
  AVAILABLE_ACTION_SUBMIT_REVISION,
} from "../../src/config/brand";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const source = readFileSync(
  path.join(repoRoot, "src/features/detail/PostDetailActionsBlock.vue"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("B3-1 actions brand strings exist and are Chinese-first", () => {
  it.each([
    ["AVAILABLE_ACTIONS_BLOCK_LABEL", AVAILABLE_ACTIONS_BLOCK_LABEL],
    ["AVAILABLE_ACTION_MARK_SOLVED", AVAILABLE_ACTION_MARK_SOLVED],
    ["AVAILABLE_ACTION_CLAIM_REWARD", AVAILABLE_ACTION_CLAIM_REWARD],
    ["AVAILABLE_ACTION_COMPLETE_ERRAND", AVAILABLE_ACTION_COMPLETE_ERRAND],
    ["AVAILABLE_ACTION_OPEN_SUBMISSION", AVAILABLE_ACTION_OPEN_SUBMISSION],
    ["AVAILABLE_ACTION_REQUEST_REVIEW", AVAILABLE_ACTION_REQUEST_REVIEW],
    ["AVAILABLE_ACTION_SUBMIT_REVISION", AVAILABLE_ACTION_SUBMIT_REVISION],
    ["AVAILABLE_ACTION_APPROVE_SUBMISSION", AVAILABLE_ACTION_APPROVE_SUBMISSION],
  ])("%s is a non-empty Chinese-first string", (_name, value) => {
    expect(value).toBeTruthy();
    expect(value.length).toBeGreaterThan(0);
    expect(value).not.toMatch(/^[a-z\s]+$/i);
  });
});

describe("PostDetailActionsBlock — surfaces availableActions atom", () => {
  it("declares an `actions: PostAvailableAction[]` prop", () => {
    expect(source).toMatch(/actions\?:\s*PostAvailableAction\[\]/);
  });

  it("imports the canonical PostAvailableAction type from src/types/post", () => {
    expect(source).toMatch(/import type \{ PostAvailableAction \} from "\.\.\/\.\.\/types\/post"/);
  });

  it("renders nothing when actions is empty / missing", () => {
    expect(source).toMatch(/v-if="entries\.length"/);
    expect(source).toMatch(/data-testid="post-detail-actions-block"/);
  });

  it("uses the brand-string label, never inline Chinese", () => {
    expect(source).toMatch(/AVAILABLE_ACTIONS_BLOCK_LABEL/);
    expect(source).not.toMatch(/>可用操作</);
  });
});

describe("PostDetailActionsBlock — type label mapping", () => {
  it("declares the seeded mapper for known action types including project/review/submission", () => {
    expect(source).toMatch(/mark_solved:\s*AVAILABLE_ACTION_MARK_SOLVED/);
    expect(source).toMatch(/claim_reward:\s*AVAILABLE_ACTION_CLAIM_REWARD/);
    expect(source).toMatch(/complete_errand:\s*AVAILABLE_ACTION_COMPLETE_ERRAND/);
    expect(source).toMatch(/open_submission:\s*AVAILABLE_ACTION_OPEN_SUBMISSION/);
    expect(source).toMatch(/request_review:\s*AVAILABLE_ACTION_REQUEST_REVIEW/);
    expect(source).toMatch(/submit_revision:\s*AVAILABLE_ACTION_SUBMIT_REVISION/);
    expect(source).toMatch(/approve_submission:\s*AVAILABLE_ACTION_APPROVE_SUBMISSION/);
  });

  it("falls back to the literal `type` for unknown actions", () => {
    expect(source).toMatch(/ACTION_TYPE_LABEL\[type\]\s*\?\?\s*type/);
  });
});

describe("PostDetailActionsBlock — enabled gating", () => {
  it("defaults `enabled` to true when absent", () => {
    // PRD V0.3 §2.4 — `enabled` is optional and defaults to true. A missing
    // field must not flip the button to disabled.
    expect(source).toMatch(/action\.enabled !== false/);
  });

  it("renders a disabled native button when enabled === false", () => {
    expect(source).toMatch(/:disabled="!entry\.enabled"/);
    expect(source).toMatch(/:aria-disabled="!entry\.enabled"/);
  });

  it("surfaces reasonText then reason via the native title tooltip", () => {
    // reasonText (human) wins over reason (machine code). Empty when enabled.
    expect(source).toMatch(/action\.reasonText\s*\|\|\s*action\.reason\s*\|\|\s*""/);
    expect(source).toMatch(/:title="entry\.tooltip"/);
  });
});

describe("PostDetailActionsBlock — click semantics (no RPC in B3-1)", () => {
  it("declares an `actionInvoked` emit carrying the action type string", () => {
    expect(source).toMatch(/actionInvoked:\s*\[type:\s*string\]/);
  });

  it("disabled clicks short-circuit before emitting", () => {
    expect(source).toMatch(/if \(!view\.enabled\) return;/);
  });

  it("enabled clicks emit `actionInvoked(type)` and nothing else", () => {
    // No fetch / api / detail.open — the block is intentionally stateless.
    expect(source).toMatch(/emit\("actionInvoked",\s*view\.type\)/);
    expect(source).not.toMatch(/import.*api\//);
    expect(source).not.toMatch(/fetch\(/);
    expect(source).not.toMatch(/detail\.open\(/);
  });
});

describe("PostDetailActionsBlock — anonymous safety", () => {
  it("does not read author / alias / user identity from the action", () => {
    // Same principle as relations: actions don't carry identity, and the
    // renderer must not reach for any author/alias/user shape.
    expect(source).not.toMatch(/\bauthor[A-Z.]/);
    expect(source).not.toMatch(/\balias[A-Z.]/);
    expect(source).not.toMatch(/\buser[A-Z.]/);
    expect(source).not.toMatch(/displayName|avatarUrl/);
  });
});
