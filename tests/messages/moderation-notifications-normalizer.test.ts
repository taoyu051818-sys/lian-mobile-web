import { describe, expect, it } from "vitest";

import { normalizeNotificationItem, normalizeNotificationResponse } from "../../src/api/messages";
import {
  NOTIF_MOD_POST_HIDDEN_BODY,
  NOTIF_MOD_POST_HIDDEN_TITLE,
  NOTIF_MOD_POST_LOCKED_BODY,
  NOTIF_MOD_POST_LOCKED_TITLE,
  NOTIF_MOD_POST_RESTORED_BODY,
  NOTIF_MOD_POST_RESTORED_TITLE,
  NOTIF_MOD_POST_UNLOCKED_BODY,
  NOTIF_MOD_POST_UNLOCKED_TITLE,
  NOTIF_MOD_REPORT_ACCEPTED_BODY,
  NOTIF_MOD_REPORT_ACCEPTED_TITLE,
  NOTIF_MOD_REPORT_IGNORED_BODY,
  NOTIF_MOD_REPORT_IGNORED_TITLE,
  NOTIF_MOD_REPORT_RESOLVED_BODY,
  NOTIF_MOD_REPORT_RESOLVED_TITLE,
} from "../../src/config/brand/notification";

/**
 * F (lian-mobile-web) — follow-up to lian-platform-server#493 — regression-cliff
 * pin for the seven admin-moderation notification types that ps#493 ships onto
 * `/api/messages`:
 *
 *   report-accepted / report-ignored / report-resolved
 *   post-hidden / post-locked / post-unlocked / post-restored
 *
 * Goal: lock the moderation dispatcher (`MODERATION_TYPE_TO_KIND` +
 * `buildModerationNotificationCopy`) against silent regressions. Sibling file
 * `notification-routing.test.ts` covers the happy paths shipped in this PR;
 * this file targets the case classes the brief calls out — round-trip,
 * tid-fallback, idempotency-key shape, every-type coverage, actor invariant.
 *
 * IMPORTANT — what "round-trip" actually means here:
 *   `NotificationItem` has NO `data` field — the wire-shape `data.{...}` and
 *   `idempotencyKey` are NOT carried through to the renderer (only `tid` /
 *   `kind` / `target` / `title` / `excerpt` / `actor` / `timestampISO` are).
 *   So "round-trip" means: every field the renderer needs survives the
 *   projection, with no field invented from thin air. The opaque `id` /
 *   `idempotencyKey` strings are preserved verbatim.
 *
 * Drop vs. fallback:
 *   `normalizeNotificationItem` NEVER drops items. Missing-tid manifests as
 *   `target.kind === "none"`. We pin that policy.
 */

const SYSTEM_ACTOR = { id: "system", name: "LIAN" } as const;

function reportEnvelope(
  status: "accepted" | "ignored" | "resolved",
  overrides: Record<string, unknown> = {},
) {
  return {
    id: `mod-report-r-1-${status}-uid-7-2026-05-22T08:00:00Z`,
    type: `report-${status}`,
    tid: 320,
    title: `举报-${status}`,
    excerpt: `举报-${status}-server`,
    actor: SYSTEM_ACTOR,
    read: false,
    timestampISO: "2026-05-22T08:00:00Z",
    idempotencyKey: `mod-report-r-1-${status}-uid-7-2026-05-22T08:00:00Z`,
    data: {
      reportId: "r-1",
      status,
      reporterUid: "uid-7",
      decidedAt: "2026-05-22T08:00:00Z",
    },
    ...overrides,
  };
}

function postEnvelope(
  verb: "hidden" | "locked" | "unlocked" | "restored",
  overrides: Record<string, unknown> = {},
) {
  return {
    id: `mod-post-410-${verb}-uid-9-2026-05-22T08:00:00Z`,
    type: `post-${verb}`,
    tid: 410,
    title: `帖子-${verb}`,
    excerpt: `帖子-${verb}-server`,
    actor: SYSTEM_ACTOR,
    read: false,
    timestampISO: "2026-05-22T08:00:00Z",
    idempotencyKey: `mod-post-410-${verb}-uid-9-2026-05-22T08:00:00Z`,
    data: {
      tid: 410,
      verb,
      authorUid: "uid-9",
      decidedAt: "2026-05-22T08:00:00Z",
    },
    ...overrides,
  };
}

describe("moderation-notifications-normalizer / case 1 — round-trip happy path (all 7 types)", () => {
  // For each of the seven types we assert the renderer-needed fields all
  // survive the projection. The wire title/excerpt are carried verbatim when
  // the backend supplies them; the front-end fallback table only kicks in
  // when those wire fields are missing/empty (case 2).

  it("report-accepted: kind / target / actionLabel / id-verbatim / actor preserved", () => {
    const wire = reportEnvelope("accepted");
    const item = normalizeNotificationItem(wire);

    expect(item.kind).toBe("moderation");
    expect(item.id).toBe(wire.id);
    expect(item.tid).toBe(320);
    expect(item.target).toEqual({ kind: "detail", tid: 320 });
    expect(item.actionLabel).toBe("查看被举报内容");
    expect(item.title).toBe("举报-accepted");
    expect(item.excerpt).toBe("举报-accepted-server");
    expect(item.actor?.id).toBe("system");
    expect(item.actor?.name).toBe("LIAN");
    expect(item.read).toBe(false);
    expect(item.timestampISO).toBe("2026-05-22T08:00:00Z");
    expect(item.type).toBe("report-accepted");
  });

  it("report-ignored: kind / target / actionLabel pinned", () => {
    const item = normalizeNotificationItem(reportEnvelope("ignored"));
    expect(item.kind).toBe("moderation");
    expect(item.target).toEqual({ kind: "detail", tid: 320 });
    expect(item.actionLabel).toBe("查看被举报内容");
  });

  it("report-resolved: kind / target / actionLabel pinned", () => {
    const item = normalizeNotificationItem(reportEnvelope("resolved"));
    expect(item.kind).toBe("moderation");
    expect(item.target).toEqual({ kind: "detail", tid: 320 });
    expect(item.actionLabel).toBe("查看被举报内容");
  });

  it("post-hidden: kind / target / actionLabel pinned", () => {
    const item = normalizeNotificationItem(postEnvelope("hidden"));
    expect(item.kind).toBe("moderation");
    expect(item.target).toEqual({ kind: "detail", tid: 410 });
    expect(item.actionLabel).toBe("查看相关帖子");
  });

  it("post-locked: kind / target / actionLabel pinned", () => {
    const item = normalizeNotificationItem(postEnvelope("locked"));
    expect(item.kind).toBe("moderation");
    expect(item.target).toEqual({ kind: "detail", tid: 410 });
    expect(item.actionLabel).toBe("查看相关帖子");
  });

  it("post-unlocked: kind / target / actionLabel pinned", () => {
    const item = normalizeNotificationItem(postEnvelope("unlocked"));
    expect(item.kind).toBe("moderation");
    expect(item.target).toEqual({ kind: "detail", tid: 410 });
    expect(item.actionLabel).toBe("查看相关帖子");
  });

  it("post-restored: kind / target / actionLabel pinned", () => {
    const item = normalizeNotificationItem(postEnvelope("restored"));
    expect(item.kind).toBe("moderation");
    expect(item.target).toEqual({ kind: "detail", tid: 410 });
    expect(item.actionLabel).toBe("查看相关帖子");
  });
});

describe("moderation-notifications-normalizer / case 2 — wire title/excerpt empty, fallback copy kicks in", () => {
  // Backend (ps#493) supplies title + excerpt verbatim, but the brief calls
  // for a frontend fallback when the envelope is sparse (e.g. empty string
  // or undefined). We pin every-type coverage so a future refactor that
  // drops one of the seven copy entries goes red.

  const FALLBACKS: Record<string, { title: string; body: string }> = {
    "report-accepted": {
      title: NOTIF_MOD_REPORT_ACCEPTED_TITLE,
      body: NOTIF_MOD_REPORT_ACCEPTED_BODY,
    },
    "report-ignored": {
      title: NOTIF_MOD_REPORT_IGNORED_TITLE,
      body: NOTIF_MOD_REPORT_IGNORED_BODY,
    },
    "report-resolved": {
      title: NOTIF_MOD_REPORT_RESOLVED_TITLE,
      body: NOTIF_MOD_REPORT_RESOLVED_BODY,
    },
    "post-hidden": {
      title: NOTIF_MOD_POST_HIDDEN_TITLE,
      body: NOTIF_MOD_POST_HIDDEN_BODY,
    },
    "post-locked": {
      title: NOTIF_MOD_POST_LOCKED_TITLE,
      body: NOTIF_MOD_POST_LOCKED_BODY,
    },
    "post-unlocked": {
      title: NOTIF_MOD_POST_UNLOCKED_TITLE,
      body: NOTIF_MOD_POST_UNLOCKED_BODY,
    },
    "post-restored": {
      title: NOTIF_MOD_POST_RESTORED_TITLE,
      body: NOTIF_MOD_POST_RESTORED_BODY,
    },
  };

  for (const [type, copy] of Object.entries(FALLBACKS)) {
    it(`${type}: empty wire title+excerpt → uses front-end fallback`, () => {
      const wire = type.startsWith("report-")
        ? reportEnvelope(type.replace("report-", "") as "accepted" | "ignored" | "resolved", {
            title: "",
            excerpt: "",
          })
        : postEnvelope(type.replace("post-", "") as "hidden" | "locked" | "unlocked" | "restored", {
            title: "",
            excerpt: "",
          });

      const item = normalizeNotificationItem(wire);
      expect(item.kind).toBe("moderation");
      expect(item.title).toBe(copy.title);
      expect(item.excerpt).toBe(copy.body);
    });
  }

  it("server title is preserved when present (front-end fallback only fires on empty)", () => {
    const item = normalizeNotificationItem(
      reportEnvelope("accepted", { title: "自定义标题", excerpt: "自定义摘要" }),
    );
    expect(item.title).toBe("自定义标题");
    expect(item.excerpt).toBe("自定义摘要");
  });
});

describe("moderation-notifications-normalizer / case 3 — missing tid (drop vs fallback)", () => {
  it("report-* missing tid: target=none with admin-backstage reason, item NOT dropped", () => {
    const wire = reportEnvelope("accepted");
    delete (wire as Record<string, unknown>).tid;
    delete (wire.data as Record<string, unknown>).tid;

    const item = normalizeNotificationItem(wire);
    expect(item.kind).toBe("moderation");
    expect(item.target.kind).toBe("none");
    if (item.target.kind === "none") {
      expect(item.target.reason).toBe("举报详情已记录在管理后台。");
    }
    expect(item.fallbackText).toBe("举报详情已记录在管理后台。");
    // Item must still be renderable — pin the no-drop policy.
    expect(item.id).toBeTruthy();
  });

  it("post-* missing tid: target=none with disabled-card reason (rare; envelope normally guarantees tid)", () => {
    // In production the post-* family is built around the post and always
    // carries tid — this test pins the safety net. If a future server bug
    // sends post-locked with no tid, we fail closed instead of crashing.
    const wire = postEnvelope("hidden");
    delete (wire as Record<string, unknown>).tid;
    delete (wire.data as Record<string, unknown>).tid;

    const item = normalizeNotificationItem(wire);
    expect(item.kind).toBe("moderation");
    expect(item.target.kind).toBe("none");
    if (item.target.kind === "none") {
      expect(item.target.reason).toBe("该帖子暂时无法打开。");
    }
  });

  it("missing tid AND missing data does NOT throw", () => {
    expect(() =>
      normalizeNotificationItem({
        type: "report-accepted",
        actor: SYSTEM_ACTOR,
      }),
    ).not.toThrow();
  });
});

describe("moderation-notifications-normalizer / case 4 — idempotency-key shape (opaque)", () => {
  // Frontend treats the idempotency key (`mod-report-<reportId>-<status>-
  // <reporterUid>-<decidedAt>` and `mod-post-<tid>-<verb>-<authorUid>-
  // <decidedAt>`) as an opaque string — the `id` field is preserved verbatim
  // from raw.id with no parsing. We pin that opacity here so a parser added
  // later has to update this test.

  it("report idempotency-key id is preserved verbatim and item still routes correctly", () => {
    const id = "mod-report-r-99-resolved-uid-42-2026-05-22T08:00:00Z";
    const item = normalizeNotificationItem(reportEnvelope("resolved", { id }));
    expect(item.id).toBe(id);
    expect(item.kind).toBe("moderation");
    expect(item.target).toEqual({ kind: "detail", tid: 320 });
  });

  it("post idempotency-key id is preserved verbatim", () => {
    const id = "mod-post-410-locked-uid-99-2026-05-22T08:00:00Z";
    const item = normalizeNotificationItem(postEnvelope("locked", { id }));
    expect(item.id).toBe(id);
    expect(item.kind).toBe("moderation");
  });

  it("when id reportId disagrees with data.reportId, frontend trusts the wire id verbatim", () => {
    // Concrete decision pin: id is opaque to the renderer; data.* is what the
    // body copy is built from when the wire fields are sparse. Disagreement
    // is allowed; the normalizer is not the layer that resolves it.
    const item = normalizeNotificationItem(
      reportEnvelope("accepted", {
        id: "mod-report-MISMATCH-accepted-uid-7-2026-05-22T08:00:00Z",
      }),
    );
    expect(item.id).toBe("mod-report-MISMATCH-accepted-uid-7-2026-05-22T08:00:00Z");
    expect(item.kind).toBe("moderation");
  });
});

describe("moderation-notifications-normalizer / case 5 — actor invariant (LIAN system)", () => {
  // ps#493 hardcodes actor={id:"system", name:"LIAN"}. The frontend NEVER
  // tries to derive a different actor for moderation, and NEVER surfaces an
  // admin reviewer's identity — those are wire-side privacy guarantees that
  // we re-pin here so a future "show reviewer name" feature surfaces in this
  // test and forces a deliberate decision.

  it("preserves the LIAN system actor verbatim", () => {
    const item = normalizeNotificationItem(reportEnvelope("accepted"));
    expect(item.actor).toEqual({ id: "system", name: "LIAN" });
  });

  it("does NOT inject an admin reviewer name into the actor (privacy contract from ps#493)", () => {
    // Even if the wire accidentally includes a `reviewerId` on `data` (it
    // shouldn't per ps#493), the normalizer must not lift it onto actor.
    const item = normalizeNotificationItem(
      reportEnvelope("accepted", {
        data: {
          reportId: "r-1",
          status: "accepted",
          reporterUid: "uid-7",
          decidedAt: "2026-05-22T08:00:00Z",
          reviewerId: "admin-leak", // hostile/buggy server payload
        },
      }),
    );
    expect(item.actor?.id).toBe("system");
    expect(item.actor?.name).toBe("LIAN");
    expect(JSON.stringify(item)).not.toContain("admin-leak");
  });

  it("missing actor on wire: emits item with actor undefined; item is NOT dropped", () => {
    const item = normalizeNotificationItem(reportEnvelope("accepted", { actor: undefined }));
    expect(item.kind).toBe("moderation");
    expect(item.actor).toBeUndefined();
    expect(item.target).toEqual({ kind: "detail", tid: 320 });
  });
});

describe("moderation-notifications-normalizer / cross-case — mixed inbox stays sorted by source order", () => {
  it("normalizeNotificationResponse keeps moderation items in the order they arrive, alongside other types", () => {
    const response = normalizeNotificationResponse({
      items: [
        reportEnvelope("accepted"),
        postEnvelope("hidden"),
        postEnvelope("locked"),
        postEnvelope("unlocked"),
        postEnvelope("restored"),
        reportEnvelope("ignored"),
        reportEnvelope("resolved"),
        { id: "v-1", type: "verification-approved", title: "认证通过" },
        { id: "r-1", type: "reply", tid: 88, title: "回复" },
      ],
    });

    const kinds = (response.items || []).map((it) => it.kind);
    expect(kinds).toEqual([
      "moderation",
      "moderation",
      "moderation",
      "moderation",
      "moderation",
      "moderation",
      "moderation",
      "verification",
      "reply",
    ]);
    // 7 moderation rows — pin the count too.
    expect(kinds.filter((k) => k === "moderation")).toHaveLength(7);
  });
});
