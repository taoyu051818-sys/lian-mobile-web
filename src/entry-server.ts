import { renderToString } from "@vue/server-renderer";
import { createApp } from "./app";

/**
 * SSR contract entry. Phase 1.1a only ships the function shape — calling it
 * renders the current `App.vue` to HTML, which (without router wiring) is the
 * empty shell. Phase 1.2 will wire route resolution and per-URL data
 * fetching; this file's `render(url)` signature is the contract those later
 * phases must keep.
 *
 * Returns `{ html, head }` so the eventual HTML transform layer can splice
 * server-rendered markup into `index.html` placeholders without re-shaping
 * the response. `head` is reserved for `<title>` / meta injection (phase
 * 1.3 — useHead wiring); kept as `""` for now.
 */
export async function render(_url: string): Promise<{ html: string; head: string }> {
  const { app } = createApp();
  const html = await renderToString(app);
  return { html, head: "" };
}
