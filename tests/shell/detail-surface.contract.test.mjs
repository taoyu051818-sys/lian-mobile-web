/**
 * Contract guard for issue #636.
 *
 * After the detail-surface lift, three things are non-negotiable:
 *
 * 1. ShellChrome renders #lian-shell-top-slot and #lian-shell-bottom-slot
 *    unconditionally — they must exist in the DOM before any teleport from
 *    PostDetailPanel can target them, on every cold-start path.
 *
 * 2. Post-detail is mounted exactly once, at the App level, by DetailSurface
 *    (Teleport to body). It must NOT be re-mounted inside any feature view.
 *
 * 3. useActiveView is independent of the detail-navigation FSM. Opening or
 *    closing a detail must not move the active view.
 *
 * These are source-level checks because they protect cold-start patch timing
 * the unit-test runtime cannot reproduce. A new contributor who reintroduces
 * a per-feature PostDetailPanel mount (e.g. by porting the historical
 * `feed-view__detail` block back) trips this file before they ship the bug.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

// --- 1. ShellChrome resident slot contract ---

test("ShellChrome renders #lian-shell-top-slot unconditionally (no v-if/v-else gate)", () => {
  const src = read("src/shell/ShellChrome.vue");
  const slotMatch = src.match(/<div[^>]*id="lian-shell-top-slot"[^>]*\/?>/);
  assert.ok(slotMatch, "top slot must be present in the template");
  // The legacy bug was guarding the slot DOM behind a state-derived v-if.
  // Resident-slot contract is: it may carry classes/attrs, but it is rendered
  // by ShellChrome's `rendersStableTopTarget` branch (always true for the
  // top region). It must not be wrapped in `<template v-if="...">` etc.
  assert.doesNotMatch(slotMatch[0], /v-if="!/);
});

test("ShellChrome renders #lian-shell-bottom-slot unconditionally", () => {
  const src = read("src/shell/ShellChrome.vue");
  const slotMatch = src.match(/<div[^>]*id="lian-shell-bottom-slot"[^>]*\/?>/);
  assert.ok(slotMatch, "bottom slot must be present in the template");
  assert.doesNotMatch(slotMatch[0], /v-if="!/);
});

test("ShellChrome stable-target branches are tied to region only, not to detailOpen state", () => {
  // The render condition for the resident slot DOM must be `region === 'top'`
  // / `region === 'bottom'` — not anything that depends on the floating-chrome
  // phase, the FSM, or shellVisible. Otherwise a chrome transition can yank
  // the teleport target.
  const src = read("src/shell/ShellChrome.vue");
  assert.match(src, /rendersStableTopTarget = computed\(\(\) => props\.region === "top"\)/);
  assert.match(src, /rendersStableBottomTarget = computed\(\(\) => props\.region === "bottom"\)/);
});

// --- 2. PostDetailPanel mount uniqueness ---

test("PostDetailPanel is mounted exactly once at the App level (DetailSurface)", () => {
  const detailSurface = read("src/app/DetailSurface.vue");
  assert.match(detailSurface, /<PostDetailPanel/);
  assert.match(detailSurface, /<Teleport to="body">/);
});

test("FeedView no longer mounts PostDetailPanel locally", () => {
  const src = read("src/features/feed/FeedView.vue");
  assert.doesNotMatch(src, /<PostDetailPanel/);
  assert.doesNotMatch(src, /import.*PostDetailPanel/);
  // The is-detail-open class on the section is also gone — FeedView is the
  // list surface only and no longer reshapes around the detail.
  assert.doesNotMatch(src, /is-detail-open/);
});

test("MessagesView no longer mounts PostDetailPanel locally", () => {
  const src = read("src/features/messages/MessagesView.vue");
  assert.doesNotMatch(src, /<PostDetailPanel/);
  assert.doesNotMatch(src, /import.*PostDetailPanel/);
  assert.doesNotMatch(src, /messages-view__detail-overlay/);
});

test("ProfileView no longer mounts a local detail overlay component", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.doesNotMatch(src, /<PostDetailPanel/);
  assert.doesNotMatch(src, /<ProfileDetailOverlay/);
  assert.doesNotMatch(src, /import.*ProfileDetailOverlay/);
});

test("ProfileDetailOverlay file has been removed", () => {
  const profileDir = fs.readdirSync(path.join(repoRoot, "src/features/profile"));
  assert.ok(
    !profileDir.includes("ProfileDetailOverlay.vue"),
    "ProfileDetailOverlay.vue must be removed; detail lives in DetailSurface",
  );
});

test("App.vue mounts DetailSurface alongside the shell", () => {
  const src = read("src/App.vue");
  assert.match(src, /import DetailSurface from "\.\/app\/DetailSurface\.vue"/);
  assert.match(src, /<DetailSurface\s*\/?>/);
});

// --- 3. useActiveView independence from detail FSM ---

test("useActiveView no longer imports or reads the detail-navigation FSM", () => {
  const src = read("src/app/useActiveView.ts");
  assert.doesNotMatch(src, /useDetailNavigation/);
  assert.doesNotMatch(src, /detailOpen/);
});

test("useActiveView's effective view is purely (secret ?? viewFromHash)", () => {
  const src = read("src/app/useActiveView.ts");
  // The shape is intentionally narrow so future regressions stand out.
  assert.match(
    src,
    /effectiveActiveViewKey = computed<AppViewKey>\(\s*\(\)\s*=>\s*secretActiveViewKey\.value\s*\?\?\s*viewFromHash\.value/,
  );
});

// --- 4. floatingChromeState detail-phase ownership ---

test("DetailSurface owns the detail floating-chrome phase signal", () => {
  // Lifted from FeedView — the FSM open/close drives the phase, not a
  // specific page's lifecycle.
  const src = read("src/app/DetailSurface.vue");
  assert.match(src, /useFloatingChromeState/);
  assert.match(src, /setDetailPhase\(open \? "open" : "idle"\)/);
});

test("FeedView no longer drives the floating-chrome detail phase", () => {
  const src = read("src/features/feed/FeedView.vue");
  assert.doesNotMatch(src, /useFloatingChromeState/);
  assert.doesNotMatch(src, /setDetailPhase/);
});
