/**
 * Issue #703 — creator/admin "结束活动" UI structure tests.
 *
 * The actual mounting infrastructure (@vue/test-utils) is not installed, so
 * we mirror the pattern in `event-reward-summary.test.ts`: read the .vue
 * source as text and pin the contract via regex. These checks guard:
 *
 *   1. Brand strings exist (no inline Chinese in the template).
 *   2. The new testid `post-detail-event-complete-action` is present.
 *   3. The completion button is gated by a `manageable` slot prop and hidden
 *      (v-if, not :disabled) for non-author/non-admin viewers.
 *   4. The button hides for terminal statuses (completed/cancelled) so the
 *      action surface never claims to act on a frozen event.
 *   5. The composable owns the POST + soft-fail wrapper and surfaces a
 *      brand-string error (never raw error text).
 *   6. Two-step UX — confirm sheet must be present before the POST fires.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  EVENT_COMPLETE_BUTTON_LABEL,
  EVENT_COMPLETE_CONFIRM_BODY,
  EVENT_COMPLETE_CONFIRM_TITLE,
  EVENT_COMPLETE_PENDING,
  EVENT_COMPLETE_SUCCESS,
  EVENT_COMPLETE_UNAVAILABLE,
} from "../../src/config/brand";

function readRepoFile(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

describe("issue #703 — brand strings exist and are Chinese-first", () => {
  it.each([
    ["EVENT_COMPLETE_BUTTON_LABEL", EVENT_COMPLETE_BUTTON_LABEL],
    ["EVENT_COMPLETE_CONFIRM_TITLE", EVENT_COMPLETE_CONFIRM_TITLE],
    ["EVENT_COMPLETE_CONFIRM_BODY", EVENT_COMPLETE_CONFIRM_BODY],
    ["EVENT_COMPLETE_PENDING", EVENT_COMPLETE_PENDING],
    ["EVENT_COMPLETE_SUCCESS", EVENT_COMPLETE_SUCCESS],
    ["EVENT_COMPLETE_UNAVAILABLE", EVENT_COMPLETE_UNAVAILABLE],
  ])("%s is a non-empty Chinese-first string", (_name, value) => {
    expect(value).toBeTruthy();
    expect(value.length).toBeGreaterThan(0);
    expect(value).not.toMatch(/^[a-z\s]+$/i);
  });
});

describe("issue #703 — PostDetailEventBlock surfaces the completion action", () => {
  const view = readRepoFile("../../src/features/detail/PostDetailEventBlock.vue");

  it("imports the new EVENT_COMPLETE_* brand strings (no inline Chinese)", () => {
    expect(view).toMatch(/EVENT_COMPLETE_BUTTON_LABEL/);
    expect(view).toMatch(/EVENT_COMPLETE_CONFIRM_TITLE/);
    expect(view).toMatch(/EVENT_COMPLETE_CONFIRM_BODY/);
    expect(view).toMatch(/EVENT_COMPLETE_PENDING/);
    // Hard-coded Chinese for the new button copy would be a regression.
    expect(view).not.toMatch(/>结束活动</);
    expect(view).not.toMatch(/>结束这场活动？</);
  });

  it("declares a stable testid the E2E proof can latch onto", () => {
    expect(view).toMatch(/data-testid="post-detail-event-complete-action"/);
  });

  it("declares a confirm sheet (two-step UX) before the POST fires", () => {
    expect(view).toMatch(/data-testid="post-detail-event-complete-confirm"/);
    expect(view).toMatch(/data-testid="post-detail-event-complete-cancel"/);
    expect(view).toMatch(/data-testid="post-detail-event-complete-submit"/);
  });

  it("hides (v-if) — never just disables — the button when viewer cannot manage", () => {
    // The button must live inside an element guarded by `showCompleteButton`,
    // and `showCompleteButton` must short-circuit when `manageable` is false.
    expect(view).toMatch(/v-if="showCompleteButton"/);
    expect(view).toMatch(/if\s*\(!props\.manageable\)\s*return false/);
  });

  it("hides the button when status is already completed or cancelled", () => {
    // Both terminal statuses must short-circuit out before the button renders.
    expect(view).toMatch(/status\.value === "completed"/);
    expect(view).toMatch(/status\.value === "cancelled"/);
  });

  it("uses EVENT_COMPLETE_PENDING during in-flight POSTs", () => {
    // The pending label has to flow through brand, not a hard-coded string.
    expect(view).toMatch(/completeBusy\s*\?\s*EVENT_COMPLETE_PENDING/);
  });

  it("declares a `manageable` prop instead of recomputing role inside the view", () => {
    // The visibility decision must be passed in (the composable resolves
    // author + admin); this view must not embed any role lookup of its own.
    expect(view).toMatch(/manageable\??:\s*boolean/);
    expect(view).not.toMatch(/fetchAuthMe|fetchAdminMe|isAdminMeRoleEligible/);
  });

  it("surfaces completeActionError through brand soft-fail (never raw)", () => {
    expect(view).toMatch(/data-testid="post-detail-event-complete-error"/);
    expect(view).toMatch(/completeActionError/);
  });
});

describe("issue #703 — useEventActions owns the POST + soft-fail contract", () => {
  const composable = readRepoFile("../../src/composables/useEventActions.ts");

  it("exports a `complete()` method alongside `act`", () => {
    expect(composable).toMatch(/async function complete\s*\(/);
    expect(composable).toMatch(/return \{[\s\S]*?complete,\s*\}/);
  });

  it("calls completeEvent() (not duplicated url path)", () => {
    expect(composable).toMatch(
      /import\s+\{[^}]*completeEvent[^}]*\}\s+from\s+["']\.\.\/api\/events["']/,
    );
    expect(composable).toMatch(/await completeEvent\(event\.eventId\)/);
  });

  it("merges authoritative fields back into the event ref (does not replace)", () => {
    // Same contract as join/cancel: spread the previous event + only overwrite
    // joinedCount / status / completedAt. Anything else would drop time /
    // capacity / reward / location.
    expect(composable).toMatch(/\.\.\.event,\s*\n\s*joinedCount:\s*result\.joinedCount,/);
    expect(composable).toMatch(/status:\s*result\.status/);
  });

  it("falls back to the EVENT_COMPLETE_UNAVAILABLE brand string on any failure", () => {
    // Soft-fail covers 403 (non-author non-admin), 404 (event missing),
    // 409 (already completed), and 5xx/network. Raw error text never reaches
    // the view.
    expect(composable).toMatch(/EVENT_COMPLETE_UNAVAILABLE/);
    expect(composable).not.toMatch(/结束活动暂时不可用/);
  });

  it("guards against double-submission and terminal events", () => {
    expect(composable).toMatch(/if\s*\(!event \|\| completeBusy\.value\)\s*return/);
    expect(composable).toMatch(/event\.status === "completed"/);
    expect(composable).toMatch(/event\.status === "cancelled"/);
  });
});

describe("issue #703 — usePostDetailExtensions wires manageable + handler", () => {
  const wiring = readRepoFile("../../src/composables/usePostDetailExtensions.ts");

  it("computes `eventManageable` from server flag, then author, then admin", () => {
    expect(wiring).toMatch(/const eventManageable = computed/);
    expect(wiring).toMatch(/currentPost\.eventManageable !== undefined/);
    expect(wiring).toMatch(/isAdminViewer\.value/);
    expect(wiring).toMatch(/fetchAdminMe/);
    expect(wiring).toMatch(/isAdminMeRoleEligible/);
  });

  it("only probes admin/auth me when the post has an event extension", () => {
    expect(wiring).toMatch(/if\s*\(!currentPost\?\.event\)\s*return/);
  });

  it("exposes a handleEventComplete handler that calls the composable", () => {
    expect(wiring).toMatch(/function handleEventComplete\(\)/);
    expect(wiring).toMatch(/EVENT_COMPLETE_SUCCESS/);
    expect(wiring).toMatch(/eventActions\.complete\(EVENT_COMPLETE_SUCCESS\)/);
  });
});

describe("issue #703 — PostDetail panel/content forward the new wires", () => {
  const content = readRepoFile("../../src/features/detail/PostDetailContent.vue");
  const panel = readRepoFile("../../src/features/detail/PostDetailPanel.vue");

  it("PostDetailContent forwards manageable + complete event", () => {
    expect(content).toMatch(/eventManageable\?:\s*boolean/);
    expect(content).toMatch(/eventComplete:\s*\[\]/);
    expect(content).toMatch(/:manageable="!!eventManageable"/);
    expect(content).toMatch(/@complete="emit\('eventComplete'\)"/);
  });

  it("PostDetailPanel binds eventManageable and routes eventComplete", () => {
    expect(panel).toMatch(/:event-manageable="eventManageable"/);
    expect(panel).toMatch(/@event-complete="handleEventComplete"/);
    expect(panel).toMatch(/handleEventComplete/);
  });
});
