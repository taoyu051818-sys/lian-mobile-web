import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

test("DetailSurface teleports the modal host to body and exposes a true dialog surface", () => {
  const src = read("src/app/DetailSurface.vue");
  assert.match(src, /<Teleport to="body">/);
  assert.match(src, /role="dialog"/);
  assert.match(src, /aria-modal="true"/);
  assert.match(src, /data-testid="detail-surface"/);
});

test("DetailSurface adds a scrim, a dedicated sheet wrapper, and self-close on host tap", () => {
  const src = read("src/app/DetailSurface.vue");
  assert.match(src, /detail-surface__scrim/);
  assert.match(src, /detail-surface__sheet/);
  assert.match(src, /@click\.self="detail\.close\('user-tap'\)"/);
});

test("DetailSurface freezes the underlying host while the overlay is open", () => {
  const src = read("src/app/DetailSurface.vue");
  assert.match(src, /setHostFrozen/);
  assert.match(
    src,
    /document\.documentElement\.classList\.toggle\("detail-surface-open", frozen\)/,
  );
  assert.match(src, /document\.body\.classList\.toggle\("detail-surface-open", frozen\)/);
  assert.match(src, /:global\(html\.detail-surface-open\)/);
  assert.match(src, /:global\(body\.detail-surface-open\)/);
  assert.match(src, /overflow:\s*hidden/);
  assert.match(src, /touch-action:\s*none/);
});

test("useActiveView keeps detail independent from the host tab so close returns to the original view", () => {
  const src = read("src/app/useActiveView.ts");
  assert.match(src, /Post detail is now an App-level overlay/);
  assert.match(
    src,
    /opening or closing a detail must not move the user off whichever tab they're on/,
  );
});

test("stable shell teleport targets stay mounted for detail top and bottom chrome", () => {
  const shellSrc = read("src/shell/ShellChrome.vue");
  const detailPanelSrc = read("src/features/detail/PostDetailPanel.vue");
  assert.match(shellSrc, /id="lian-shell-top-slot"/);
  assert.match(shellSrc, /id="lian-shell-bottom-slot"/);
  assert.match(detailPanelSrc, /<Teleport defer to="#lian-shell-top-slot">/);
  assert.match(detailPanelSrc, /<Teleport defer to="#lian-shell-bottom-slot">/);
});
