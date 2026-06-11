/**
 * PRD V0.3 §2.4 / B3-1 — PostDetailRelationsBlock structure tests.
 *
 * The repo intentionally does not ship `@vue/test-utils` (see
 * `tests/event/event-completion-ui.test.ts` and `tests/ui/LianButton.test.ts`
 * for the rationale: every other component test is a source-text contract).
 * This file follows the same convention — we read the .vue source as text and
 * pin the load-bearing structural decisions:
 *
 *   1. Empty / missing relations renders nothing (v-if guard on the section).
 *   2. Known relation types map to brand strings; unknown types fall back to
 *      the literal `type` value.
 *   3. `target.kind === "post"` produces a clickable button that routes
 *      through the in-app detail-navigation FSM (no router-link — this repo
 *      has no vue-router, so `<router-link>` would be a non-functional
 *      placeholder; see `MerchantCenterView.openPost`).
 *   4. `target.kind === "resource"` renders read-only text only.
 *   5. Anonymous-safety: the renderer must NEVER touch author / alias / user
 *      identity fields. It only reads `type`, `target.kind`, `target.id`.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  RELATIONS_BLOCK_LABEL,
  RELATION_TARGET_RESOURCE_PREFIX,
  RELATION_TYPE_EVENT_RECAP,
  RELATION_TYPE_EVENT_REWARD,
  RELATION_TYPE_HELP_EVENT_LINK,
  RELATION_TYPE_MERCHANT_ERRAND,
  RELATION_TYPE_PROJECT_REVIEW,
  RELATION_TYPE_PROJECT_SUBMISSION,
  RELATION_TYPE_SOLUTION_EVENT,
  RELATION_TYPE_SUBMISSION_REVIEW,
} from "../../src/config/brand";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const source = readFileSync(
  path.join(repoRoot, "src/features/detail/PostDetailRelationsBlock.vue"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("B3-1 brand strings exist and are Chinese-first", () => {
  it.each([
    ["RELATIONS_BLOCK_LABEL", RELATIONS_BLOCK_LABEL],
    ["RELATION_TARGET_RESOURCE_PREFIX", RELATION_TARGET_RESOURCE_PREFIX],
    ["RELATION_TYPE_HELP_EVENT_LINK", RELATION_TYPE_HELP_EVENT_LINK],
    ["RELATION_TYPE_SOLUTION_EVENT", RELATION_TYPE_SOLUTION_EVENT],
    ["RELATION_TYPE_EVENT_RECAP", RELATION_TYPE_EVENT_RECAP],
    ["RELATION_TYPE_MERCHANT_ERRAND", RELATION_TYPE_MERCHANT_ERRAND],
    ["RELATION_TYPE_PROJECT_SUBMISSION", RELATION_TYPE_PROJECT_SUBMISSION],
    ["RELATION_TYPE_PROJECT_REVIEW", RELATION_TYPE_PROJECT_REVIEW],
    ["RELATION_TYPE_SUBMISSION_REVIEW", RELATION_TYPE_SUBMISSION_REVIEW],
    ["RELATION_TYPE_EVENT_REWARD", RELATION_TYPE_EVENT_REWARD],
  ])("%s is a non-empty Chinese-first string", (_name, value) => {
    expect(value).toBeTruthy();
    expect(value.length).toBeGreaterThan(0);
    expect(value).not.toMatch(/^[a-z\s]+$/i);
  });
});

describe("PostDetailRelationsBlock — surfaces the relations atom from PostDetail", () => {
  it("declares a `relations: PostRelation[]` prop", () => {
    expect(source).toMatch(/relations\?:\s*PostRelation\[\]/);
  });

  it("imports the canonical PostRelation type from src/types/post", () => {
    // No dual-shape detection — we read the canonical wire shape only.
    expect(source).toMatch(/import type \{ PostRelation \} from "\.\.\/\.\.\/types\/post"/);
  });

  it("renders nothing when relations is empty / missing (v-if guard on section)", () => {
    // Empty / undefined input must NOT mount the section so the layout stays
    // byte-identical for posts the backend has not yet emitted relations for.
    expect(source).toMatch(/v-if="entries\.length"/);
    expect(source).toMatch(/data-testid="post-detail-relations-block"/);
  });

  it("uses the brand-string label, never inline Chinese", () => {
    expect(source).toMatch(/RELATIONS_BLOCK_LABEL/);
    expect(source).not.toMatch(/>相关</);
  });
});

describe("PostDetailRelationsBlock — type label mapping", () => {
  it("declares the seeded mapper covering all known graph relation types", () => {
    expect(source).toMatch(/help_event_link:\s*RELATION_TYPE_HELP_EVENT_LINK/);
    expect(source).toMatch(/solution_event:\s*RELATION_TYPE_SOLUTION_EVENT/);
    expect(source).toMatch(/event_recap:\s*RELATION_TYPE_EVENT_RECAP/);
    expect(source).toMatch(/merchant_errand:\s*RELATION_TYPE_MERCHANT_ERRAND/);
    expect(source).toMatch(/project_submission:\s*RELATION_TYPE_PROJECT_SUBMISSION/);
    expect(source).toMatch(/project_review:\s*RELATION_TYPE_PROJECT_REVIEW/);
    expect(source).toMatch(/review_submission:\s*RELATION_TYPE_SUBMISSION_REVIEW/);
    expect(source).toMatch(/submission_review:\s*RELATION_TYPE_SUBMISSION_REVIEW/);
    expect(source).toMatch(/event_reward:\s*RELATION_TYPE_EVENT_REWARD/);
  });

  it("falls back to the literal `type` for unknown relation kinds", () => {
    // The fallback path is what lets the backend grow new relation types
    // without forcing a frontend release; the renderer must not throw or
    // hide unknown types.
    expect(source).toMatch(/RELATION_TYPE_LABEL\[type\]\s*\?\?\s*type/);
  });
});

describe("PostDetailRelationsBlock — target rendering", () => {
  it("post targets render as a button that calls detail.open(tid)", () => {
    // The codebase has no vue-router; `<router-link>` would be inert. The
    // load-bearing contract is "post target taps go through the
    // detail-navigation FSM" — same entry point feed cards / merchant center
    // already use.
    expect(source).toMatch(/useDetailNavigation/);
    expect(source).toMatch(/detail\.open\(view\.postTid,\s*"card"\)/);
    expect(source).toMatch(/data-testid="post-detail-relations-target-post"/);
    expect(source).toMatch(/v-if="entry\.isPost && entry\.postTid !== null"/);
  });

  it("resource targets render as inert text (no router, no detail.open)", () => {
    expect(source).toMatch(/data-testid="post-detail-relations-target-resource"/);
    expect(source).toMatch(/RELATION_TARGET_RESOURCE_PREFIX/);
  });

  it("post tids are coerced to a positive number — invalid ids fall to text", () => {
    // The wire shape is `id: string`, but post tids are numeric. The
    // renderer must coerce + validate (positive finite) before navigating.
    expect(source).toMatch(/Number\(targetId\)/);
    expect(source).toMatch(/Number\.isFinite\(postTid\)\s*&&\s*postTid\s*>\s*0/);
  });
});

describe("PostDetailRelationsBlock — anonymous safety", () => {
  it("does not read author / alias / user identity from the relation", () => {
    // The anonymous-design principle (memory:feedback_anonymous_design_principle)
    // forbids regressing to real-identity fields when an alias is missing.
    // Relations carry only `type` / `target` / `role` — the renderer must
    // not reach for any author/alias/user shape and pretend it has identity.
    expect(source).not.toMatch(/\bauthor[A-Z.]/);
    expect(source).not.toMatch(/\balias[A-Z.]/);
    expect(source).not.toMatch(/\buser[A-Z.]/);
    expect(source).not.toMatch(/displayName|avatarUrl/);
  });

  it("only consumes type / target.kind / target.id / role from the relation", () => {
    // The rest of the wire shape is intentionally untouched. role is
    // declared on the type but not yet rendered (out of scope for B3-1).
    expect(source).toMatch(/relation\.type/);
    expect(source).toMatch(/relation\.target\?\.kind/);
    expect(source).toMatch(/relation\.target\?\.id/);
  });
});

describe("PostDetailRelationsBlock — constraints from team rules", () => {
  it("does not introduce dual-shape detection for the relations array", () => {
    // Wire shape is array-only (memory:feedback_v2_metadata_schema_dual_shape).
    expect(source).not.toMatch(/Array\.isArray.*relations.*\?.*Object\.values/);
    expect(source).not.toMatch(/relations\.components/);
  });
});
