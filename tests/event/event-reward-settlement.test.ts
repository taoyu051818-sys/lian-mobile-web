/**
 * Event reward-settlement readout (issue #705).
 *
 * After F1 (#703) author-driven `/complete` and B1 (#444 — merge
 * 6c37ece93fc1ffcf255f26896563458f72526503) author-driven `/reward`,
 * `metadata.event.rewardSettlement` carries a frozen settlement record on the
 * wire. This file pins:
 *
 *   1. `EventRewardSettlement` round-trips intact through the normalizer.
 *   2. Missing / malformed settlements are dropped, not invented (matches the
 *      same drop pattern used for `status` / `completedAt`).
 *   3. The post-detail event block renders a `data-testid="post-detail-event-
 *      reward-settlement"` readout with brand strings only when the wire
 *      carries a settlement.
 *   4. The readout is read-only — no buttons, no API calls. F1 owns
 *      `/complete`; B1 owns `/reward`.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  EVENT_REWARD_SETTLED_AT,
  EVENT_REWARD_SETTLED_LABEL,
  EVENT_REWARD_SETTLED_PER_JOINER,
  EVENT_REWARD_SETTLED_TOTAL,
} from "../../src/config/brand";
import {
  normalizeEventExtension,
  normalizeEventRewardSettlement,
} from "../../src/platform/api-normalizers";

function readRepoFile(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

describe("issue #705 — settlement brand strings", () => {
  it.each([
    ["EVENT_REWARD_SETTLED_LABEL", EVENT_REWARD_SETTLED_LABEL],
    ["EVENT_REWARD_SETTLED_PER_JOINER", EVENT_REWARD_SETTLED_PER_JOINER],
    ["EVENT_REWARD_SETTLED_TOTAL", EVENT_REWARD_SETTLED_TOTAL],
    ["EVENT_REWARD_SETTLED_AT", EVENT_REWARD_SETTLED_AT],
  ])("%s is a non-empty Chinese-first string", (_name, value) => {
    expect(value).toBeTruthy();
    expect(value.length).toBeGreaterThan(0);
    expect(value).not.toMatch(/^[a-z\s]+$/i);
  });

  it("templates carry their substitution placeholders so the view fills them", () => {
    expect(EVENT_REWARD_SETTLED_PER_JOINER).toMatch(/\{amount\}/);
    expect(EVENT_REWARD_SETTLED_TOTAL).toMatch(/\{total\}/);
    expect(EVENT_REWARD_SETTLED_TOTAL).toMatch(/\{count\}/);
    expect(EVENT_REWARD_SETTLED_AT).toMatch(/\{at\}/);
  });
});

describe("issue #705 — normalizeEventRewardSettlement round-trip", () => {
  const FULL = {
    settlementId: "stl_abc123",
    settledAt: "2026-05-19T12:00:00.000Z",
    settledBy: "u_author",
    perJoiner: 30,
    joinerCount: 2,
    totalPaid: 60,
    remainder: 0,
    joinerIds: ["u_joiner_a", "u_joiner_b"],
    honorAwarded: { u_joiner_a: 1, u_joiner_b: 1, u_author: 5 },
  };

  it("round-trips a full settlement intact", () => {
    const out = normalizeEventRewardSettlement(FULL);
    expect(out).toEqual(FULL);
  });

  it("round-trips when nested on the event extension", () => {
    const ext = normalizeEventExtension({
      eventId: "evt-1",
      joinedCount: 2,
      rewardSettlement: FULL,
    });
    expect(ext?.rewardSettlement).toEqual(FULL);
    expect(ext?.eventId).toBe("evt-1");
  });

  it("drops the whole settlement when settlementId is missing", () => {
    const out = normalizeEventRewardSettlement({ ...FULL, settlementId: "" });
    expect(out).toBeUndefined();
  });

  it("drops the whole settlement when input is null/undefined/non-object", () => {
    expect(normalizeEventRewardSettlement(undefined)).toBeUndefined();
    expect(normalizeEventRewardSettlement(null)).toBeUndefined();
    expect(normalizeEventRewardSettlement(42)).toBeUndefined();
    expect(normalizeEventRewardSettlement("stl_abc")).toBeUndefined();
    expect(normalizeEventRewardSettlement([1, 2, 3])).toBeUndefined();
  });

  it("coerces a malformed perJoiner to 0 (matches asNonNegInt convention)", () => {
    const out = normalizeEventRewardSettlement({ ...FULL, perJoiner: "not-a-number" });
    expect(out?.perJoiner).toBe(0);
    // The other fields stay intact — render what the server says.
    expect(out?.settlementId).toBe(FULL.settlementId);
    expect(out?.totalPaid).toBe(FULL.totalPaid);
  });

  it("does NOT second-guess a totalPaid !== perJoiner * joinerCount", () => {
    const inconsistent = { ...FULL, totalPaid: 999 };
    const out = normalizeEventRewardSettlement(inconsistent);
    expect(out?.totalPaid).toBe(999);
    expect(out?.perJoiner).toBe(30);
    expect(out?.joinerCount).toBe(2);
  });

  it("omits settledAt / settledBy when blank rather than emitting empty strings", () => {
    const partial = { ...FULL, settledAt: "", settledBy: "" };
    const out = normalizeEventRewardSettlement(partial);
    expect(out?.settlementId).toBe(FULL.settlementId);
    expect(out).not.toHaveProperty("settledAt");
    expect(out).not.toHaveProperty("settledBy");
  });

  it("filters out non-string entries from joinerIds via asStringArray", () => {
    const out = normalizeEventRewardSettlement({
      ...FULL,
      joinerIds: ["u_joiner_a", 42, null, "", "u_joiner_b"],
    });
    expect(out?.joinerIds).toEqual(["u_joiner_a", "42", "u_joiner_b"]);
  });

  it("drops a malformed honorAwarded that is not a record", () => {
    const out = normalizeEventRewardSettlement({ ...FULL, honorAwarded: "nope" });
    expect(out?.honorAwarded).toBeUndefined();
  });
});

describe("issue #705 — event without a settlement renders unchanged", () => {
  it("normalizes an event without rewardSettlement and omits the field", () => {
    const ext = normalizeEventExtension({ eventId: "evt-1", joinedCount: 0 });
    expect(ext?.eventId).toBe("evt-1");
    expect(ext).not.toHaveProperty("rewardSettlement");
  });

  it("normalizes an event with malformed rewardSettlement and omits the field", () => {
    const ext = normalizeEventExtension({
      eventId: "evt-1",
      joinedCount: 0,
      rewardSettlement: { settlementId: "" },
    });
    expect(ext?.eventId).toBe("evt-1");
    expect(ext).not.toHaveProperty("rewardSettlement");
  });
});

describe("issue #705 — PostDetailEventBlock renders the readout (read-only)", () => {
  // The settlement readout was extracted into its own SFC
  // (`PostDetailEventSettlement.vue`) so the parent block stays focused on
  // the join/cancel + creator-side complete flow. The contract is unchanged
  // — brand-only copy, stable testid, read-only — but the assertions now
  // target the extracted component (which owns the imports + testid + DOM)
  // and the parent's wiring (v-if gate + child render).
  const block = readRepoFile("../../src/features/detail/PostDetailEventBlock.vue");
  const settlement = readRepoFile("../../src/features/detail/PostDetailEventSettlement.vue");

  it("imports the four new EVENT_REWARD_SETTLED_* brand strings", () => {
    expect(settlement).toMatch(/EVENT_REWARD_SETTLED_LABEL/);
    expect(settlement).toMatch(/EVENT_REWARD_SETTLED_PER_JOINER/);
    expect(settlement).toMatch(/EVENT_REWARD_SETTLED_TOTAL/);
    expect(settlement).toMatch(/EVENT_REWARD_SETTLED_AT/);
  });

  it("declares a stable testid the F3 / e2e proof can latch onto", () => {
    expect(settlement).toMatch(/data-testid="post-detail-event-reward-settlement"/);
  });

  it("hides (v-if) the readout when rewardSettlement is missing", () => {
    // Parent block gates the rendered child on `settlement`, which is the
    // computed wrapper around `props.event.rewardSettlement`. Equivalent to
    // the previous `v-if="settlement"` on an inline div.
    expect(block).toMatch(
      /<PostDetailEventSettlement\s+v-if="settlement"\s+:settlement="settlement"\s*\/>/,
    );
  });

  it("does NOT inline raw Chinese — every label flows through brand", () => {
    expect(settlement).not.toMatch(/>奖励已结算</);
    expect(settlement).not.toMatch(/>每人\s*\{?amount\}?\s*积分</);
    expect(settlement).not.toMatch(/>结算于</);
  });

  it("contains no buttons / actions / API calls in the settlement block", () => {
    // Read-only readout: no buttons, no click handlers, no emits. Scan the
    // template region of the settlement SFC (the `<style>` block uses none
    // of these; the `<script setup>` declares `defineProps` but does not
    // emit, so a global scan over the file is also safe here).
    const templateMatch = settlement.match(/<template>[\s\S]*?<\/template>/);
    expect(templateMatch, "settlement template must exist").toBeTruthy();
    const template = templateMatch![0];
    expect(template).not.toMatch(/<button/);
    expect(template).not.toMatch(/@click/);
    expect(settlement).not.toMatch(/\bemit\(/);
  });
});
