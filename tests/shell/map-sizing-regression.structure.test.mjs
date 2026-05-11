import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

// --- Map uses full-bleed layout mode ---

test("view-types.ts assigns full-bleed layout mode to map", () => {
  const src = read("src/app/view-types.ts");
  assert.match(src, /map:\s*"full-bleed"/);
});

// --- ContentFrame full-bleed CSS ---

test("content-frame.css full-bleed modifier removes max-width constraint", () => {
  const css = read("src/shell/content-frame.css");
  const fullBleed = css.slice(css.indexOf(".content-frame--full-bleed"));
  assert.match(fullBleed, /max-width:\s*none/);
  assert.match(fullBleed, /width:\s*100%/);
});

test("main.css full-bleed grid removes border-radius on map stage wrapper", () => {
  const css = read("src/styles/main.css");
  assert.match(css, /vue-shell__grid--full-bleed[\s\S]*?map-view__stage-wrap[\s\S]*?border-radius:\s*0/);
});

// --- MapView sizing ---

test("MapView stage has min-height for usable map area", () => {
  const src = read("src/views/MapView.vue");
  assert.match(src, /min-height:\s*360px/);
});

test("MapView stage has mobile breakpoint min-height", () => {
  const src = read("src/views/MapView.vue");
  assert.match(src, /max-width:\s*640px[\s\S]*?min-height:\s*300px/);
});

test("MapView post-detail panel is sticky-positioned above tab bar", () => {
  const src = read("src/views/MapView.vue");
  assert.match(src, /position:\s*sticky/);
  assert.match(src, /bottom:\s*calc\(92px/);
});

// --- Map chrome integration ---

test("useMapChrome uses useShellChrome for map filter and place chrome", () => {
  const src = read("src/views/map/useMapChrome.ts");
  assert.match(src, /useShellChrome/);
});

test("useMapChrome exports filter spec builder for map top chrome", () => {
  const src = read("src/views/map/useMapChrome.ts");
  assert.match(src, /export function defineMapFilterSpec/);
  assert.match(src, /export function defineMapTopChrome/);
});

test("useMapChrome exports place bottom chrome builder", () => {
  const src = read("src/views/map/useMapChrome.ts");
  assert.match(src, /export function defineMapBottomChromeForPlace/);
  assert.match(src, /export function defineMapDefaultBottomChrome/);
});

// --- MapCanvas leaflet integration ---

test("MapCanvas.vue exists for leaflet rendering", () => {
  const src = read("src/views/map/MapCanvas.vue");
  assert.ok(src.length > 0, "MapCanvas.vue should not be empty");
});
