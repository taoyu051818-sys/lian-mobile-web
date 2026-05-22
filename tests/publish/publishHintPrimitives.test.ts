import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * PR-2 (publish hint/warning unification) snapshot lock.
 *
 * Locks the rendered DOM of the two new primitives (PublishMessage,
 * PublishGateNotice) by snapshotting their <template> source. If anyone
 * touches the structure (variant class wiring, aria role/live derivation,
 * gate slot layout, CTA wiring) the snapshot will diverge and force a
 * conscious update — that's the contract the audit fixed in place.
 *
 * The repo doesn't ship @vue/test-utils, so we snapshot the source DOM
 * directly. That's the same pattern other publish tests use to lock
 * structure (tests/publish/*.structure.test.mjs); the snapshot here is
 * stricter because it covers the entire <template> block, not just a few
 * regex assertions.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

function readTemplate(rel: string): string {
  const src = fs.readFileSync(path.join(repoRoot, rel), "utf8");
  // Capture <template>...</template> exactly, including the outer tags. If
  // the file ever loses its template block this match fails loudly rather
  // than producing an empty snapshot.
  const match = src.match(/<template>[\s\S]*?<\/template>/);
  if (!match) {
    throw new Error(`No <template> block found in ${rel}`);
  }
  return match[0];
}

describe("PR-2 publish primitives DOM structure", () => {
  it("PublishMessage variants render as div.publish-message--<variant> with derived aria role/live", () => {
    expect(readTemplate("src/features/publish/PublishMessage.vue")).toMatchSnapshot();
  });

  it("PublishGateNotice renders title + slot body + CTA button with aria-label", () => {
    expect(readTemplate("src/features/publish/PublishGateNotice.vue")).toMatchSnapshot();
  });
});
