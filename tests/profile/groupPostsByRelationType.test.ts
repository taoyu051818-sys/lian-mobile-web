/**
 * PRD V0.3 §2.4 / B3-2 — `groupPostsByRelationType` pure-function spec.
 *
 * Locks the bucket contract (which relation type goes to which UI section),
 * the once-per-bucket invariant (a post with multiple relations into the
 * same bucket only renders once), and the cross-bucket priority order
 * (a post that matches multiple buckets renders only in the first match).
 */
import { describe, expect, it } from "vitest";
import {
  groupPostsByRelationType,
  PROFILE_RELATION_GROUP_ORDER,
  PROFILE_RELATION_GROUP_TYPES,
} from "../../src/features/profile/groupPostsByRelationType";
import type { ProfileListItem } from "../../src/types/profile";

function row(
  tid: number,
  relations: Array<{ type: string }>,
  extra: Partial<ProfileListItem> = {},
): ProfileListItem {
  return {
    tid,
    id: String(tid),
    title: `帖子-${tid}`,
    relations: relations.map((relation) => ({
      type: relation.type,
      target: { kind: "post", id: String(tid * 10 + 1) },
    })),
    ...extra,
  };
}

describe("groupPostsByRelationType", () => {
  it("buckets event_recap and event_reward into participated", () => {
    const result = groupPostsByRelationType([
      row(1, [{ type: "event_recap" }]),
      row(2, [{ type: "event_reward" }]),
    ]);

    expect(result.participated.map((item) => item.tid)).toEqual([1, 2]);
    expect(result.helped).toHaveLength(0);
    expect(result.merchant).toHaveLength(0);
  });

  it("buckets help_event_link and solution_event into helped", () => {
    const result = groupPostsByRelationType([
      row(3, [{ type: "help_event_link" }]),
      row(4, [{ type: "solution_event" }]),
    ]);

    expect(result.helped.map((item) => item.tid)).toEqual([3, 4]);
    expect(result.participated).toHaveLength(0);
    expect(result.merchant).toHaveLength(0);
  });

  it("buckets merchant_errand and project_submission into merchant", () => {
    const result = groupPostsByRelationType([
      row(5, [{ type: "merchant_errand" }]),
      row(6, [{ type: "project_submission" }]),
    ]);

    expect(result.merchant.map((item) => item.tid)).toEqual([5, 6]);
    expect(result.participated).toHaveLength(0);
    expect(result.helped).toHaveLength(0);
  });

  it("dedupes a post with multiple relations into the same bucket", () => {
    // event_recap + event_reward both bucket into "participated" — the post
    // must surface exactly once, not twice.
    const result = groupPostsByRelationType([
      row(7, [{ type: "event_recap" }, { type: "event_reward" }]),
    ]);

    expect(result.participated).toHaveLength(1);
    expect(result.participated[0]?.tid).toBe(7);
  });

  it("places a multi-bucket post only into the first bucket in ORDER", () => {
    // help_event_link (helped) + merchant_errand (merchant) — ORDER puts
    // helped before merchant, so the post lands in helped only.
    const result = groupPostsByRelationType([
      row(8, [{ type: "help_event_link" }, { type: "merchant_errand" }]),
    ]);

    expect(result.helped.map((item) => item.tid)).toEqual([8]);
    expect(result.merchant).toHaveLength(0);
  });

  it("ignores items with empty relations array", () => {
    const result = groupPostsByRelationType([row(9, [])]);

    expect(result.participated).toHaveLength(0);
    expect(result.helped).toHaveLength(0);
    expect(result.merchant).toHaveLength(0);
  });

  it("ignores items with missing relations field", () => {
    const result = groupPostsByRelationType([{ tid: 10, id: "10", title: "无 relations" }]);

    expect(result.participated).toHaveLength(0);
    expect(result.helped).toHaveLength(0);
    expect(result.merchant).toHaveLength(0);
  });

  it("ignores items whose relation types are all unknown", () => {
    const result = groupPostsByRelationType([
      row(11, [{ type: "future_kind_xyz" }, { type: "another_unknown" }]),
    ]);

    expect(result.participated).toHaveLength(0);
    expect(result.helped).toHaveLength(0);
    expect(result.merchant).toHaveLength(0);
  });

  it("buckets groupbuy_joined and groupbuy_created into groupbuy", () => {
    const result = groupPostsByRelationType([
      row(13, [{ type: "groupbuy_joined" }]),
      row(14, [{ type: "groupbuy_created" }]),
    ]);

    expect(result.groupbuy.map((item) => item.tid)).toEqual([13, 14]);
    expect(result.participated).toHaveLength(0);
    expect(result.helped).toHaveLength(0);
    expect(result.merchant).toHaveLength(0);
  });

  it("handles an empty input list", () => {
    const result = groupPostsByRelationType([]);

    expect(result).toEqual({ participated: [], helped: [], merchant: [], groupbuy: [] });
  });

  it("dedupes when the same tid appears twice within the bucket-source list", () => {
    // Defensive: backend should not ship two rows for the same tid in a single
    // /api/me/posts response, but if it did, the bucket should still contain
    // the tid only once.
    const result = groupPostsByRelationType([
      row(12, [{ type: "event_recap" }]),
      row(12, [{ type: "event_reward" }]),
    ]);

    expect(result.participated).toHaveLength(1);
    expect(result.participated[0]?.tid).toBe(12);
  });

  it("ORDER and TYPES tables stay in sync (sanity check)", () => {
    // Adding a new bucket key without updating ORDER would silently drop the
    // bucket from the UI render. Lock the invariant here.
    expect(new Set(PROFILE_RELATION_GROUP_ORDER)).toEqual(
      new Set(Object.keys(PROFILE_RELATION_GROUP_TYPES)),
    );
  });

  it("the eight required relation types each map to exactly one bucket", () => {
    // Lock the PRD V0.3 §2.4 enum plus the issue #993 group-buy additions.
    const required = [
      "event_recap",
      "event_reward",
      "help_event_link",
      "solution_event",
      "merchant_errand",
      "project_submission",
      "groupbuy_joined",
      "groupbuy_created",
    ];
    for (const type of required) {
      const matches = PROFILE_RELATION_GROUP_ORDER.filter((group) =>
        PROFILE_RELATION_GROUP_TYPES[group].has(type),
      );
      expect(matches).toHaveLength(1);
    }
  });
});
