/**
 * Event reward-summary readout (issue #650).
 *
 * The backend already carries `metadata.event.rewardSummary` end-to-end (set
 * at publish time, normalized on the read side, exposed on
 * `EventPostExtension`). Until this fix the detail view simply dropped it,
 * so participants could not see "what do I get for joining". These tests pin
 * the brand string + view contract so the field stops being silently lost,
 * and exercise the normalizer to confirm rewardSummary survives the wire.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { EVENT_REWARD_LABEL } from "../../src/config/brand";
import { normalizeEventExtension } from "../../src/platform/api-normalizers";

function readRepoFile(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

describe("issue #650 — event reward summary brand label", () => {
  it("exposes a non-empty Chinese brand string so views never inline copy", () => {
    expect(EVENT_REWARD_LABEL).toBeTruthy();
    expect(EVENT_REWARD_LABEL.length).toBeGreaterThan(0);
    // Brand strings are Chinese-first in this app; raw English placeholder
    // text would be a regression.
    expect(EVENT_REWARD_LABEL).not.toMatch(/^[a-z\s]+$/i);
  });
});

describe("issue #650 — normalizeEventExtension preserves rewardSummary", () => {
  it("surfaces rewardSummary when the wire sets it", () => {
    const ext = normalizeEventExtension({
      eventId: "evt-1",
      joinedCount: 0,
      rewardSummary: "义工时 +1, 现场茶歇",
    });
    expect(ext?.rewardSummary).toBe("义工时 +1, 现场茶歇");
  });

  it("omits the field when the publisher left it blank (does not invent text)", () => {
    const noField = normalizeEventExtension({ eventId: "evt-1", joinedCount: 0 });
    expect(noField?.rewardSummary).toBeUndefined();

    const empty = normalizeEventExtension({
      eventId: "evt-1",
      joinedCount: 0,
      rewardSummary: "",
    });
    expect(empty?.rewardSummary).toBeUndefined();
  });
});

describe("issue #650 — PostDetailEventBlock renders the reward summary", () => {
  const view = readRepoFile("../../src/features/detail/PostDetailEventBlock.vue");

  it("imports the EVENT_REWARD_LABEL brand string", () => {
    expect(view).toMatch(/EVENT_REWARD_LABEL/);
  });

  it("renders the rewardSummary block via a stable testid the E2E proof can latch onto", () => {
    expect(view).toMatch(/data-testid="post-detail-event-reward"/);
  });

  it("hides the reward block when rewardSummary is missing (v-if, not always-on)", () => {
    // Look at the block element specifically — `v-if="event.rewardSummary"`
    // makes the absence path observable to the structure tests too.
    const blockMatch = view.match(
      /<div[^>]*class="post-detail-event-block__reward"[^>]*>[\s\S]*?<\/div>/,
    );
    expect(blockMatch, "reward block must exist as its own element").toBeTruthy();
    const block = blockMatch![0];
    expect(block).toMatch(/v-if="event\.rewardSummary"/);
  });

  it("preserves multi-line publisher copy via white-space: pre-wrap", () => {
    expect(view).toMatch(/white-space:\s*pre-wrap/);
  });

  it("does not inline raw Chinese copy — every label flows through brand", () => {
    // The block label itself must come from brand, not be hard-coded.
    expect(view).not.toMatch(/>奖励说明</);
  });
});
