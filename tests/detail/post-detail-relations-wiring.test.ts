/**
 * PRD V0.3 §2.4 / B3-1 — wiring test for relations + availableActions through
 * the PostDetail layer cake.
 *
 * Source-text contract (no @vue/test-utils, same convention as
 * `event-completion-ui.test.ts`). Pins the load-bearing decisions:
 *
 *   1. PostDetailContent.vue declares the two new props and forwards them to
 *      the new blocks; both blocks sit AFTER the trade block so existing
 *      layout (event/help/merchant/trade in that order) keeps stable.
 *   2. PostDetailPanel.vue forwards `post.relations` / `post.availableActions`
 *      down through the render path — this is the only place we read those
 *      fields off the store-shaped PostDetail.
 *   3. The relayed `availableActionInvoked` event has a panel-side handler.
 *      It's intentionally a no-op for B3-1 (no per-type RPC handler yet).
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

function read(rel: string): string {
  return readFileSync(path.join(repoRoot, rel), "utf8").replace(/\r\n/g, "\n");
}

describe("PostDetailContent.vue — wires the two new blocks", () => {
  const content = read("src/features/detail/PostDetailContent.vue");

  it("imports both new blocks", () => {
    expect(content).toMatch(
      /import PostDetailRelationsBlock from "\.\/PostDetailRelationsBlock\.vue"/,
    );
    expect(content).toMatch(/import PostDetailActionsBlock from "\.\/PostDetailActionsBlock\.vue"/);
  });

  it("declares relations + availableActions props with their canonical types", () => {
    expect(content).toMatch(/relations\?:\s*PostRelation\[\]/);
    expect(content).toMatch(/availableActions\?:\s*PostAvailableAction\[\]/);
  });

  it("declares the relayed availableActionInvoked emit", () => {
    expect(content).toMatch(/availableActionInvoked:\s*\[type:\s*string\]/);
  });

  it("mounts both blocks AFTER the trade block (existing layout stays stable)", () => {
    // The order matters: event/help/help-manage/merchant/trade is the
    // existing capability cascade. New blocks sit after that and before the
    // PostComponentsSlot so V2 component registry renderers still come last.
    const tradeIdx = content.indexOf("<PostDetailTradeBlock");
    const relationsIdx = content.indexOf("<PostDetailRelationsBlock");
    const actionsIdx = content.indexOf("<PostDetailActionsBlock");
    const slotIdx = content.indexOf("<PostComponentsSlot");
    expect(tradeIdx).toBeGreaterThan(0);
    expect(relationsIdx).toBeGreaterThan(tradeIdx);
    expect(actionsIdx).toBeGreaterThan(relationsIdx);
    expect(slotIdx).toBeGreaterThan(actionsIdx);
  });

  it("forwards relations + availableActions + event listener to the blocks", () => {
    expect(content).toMatch(/<PostDetailRelationsBlock\s+:relations="relations"\s*\/>/);
    expect(content).toMatch(/:actions="availableActions"/);
    expect(content).toMatch(/@action-invoked="emit\('availableActionInvoked', \$event\)"/);
  });
});

describe("PostDetailPanel.vue — forwards post.relations / post.availableActions", () => {
  const panel = read("src/features/detail/PostDetailPanel.vue");

  it("binds both fields off the post store shape", () => {
    expect(panel).toMatch(/:relations="post\?\.relations"/);
    expect(panel).toMatch(/:available-actions="post\?\.availableActions"/);
  });

  it("listens for available-action-invoked at the panel boundary", () => {
    expect(panel).toMatch(/@available-action-invoked="handleAvailableActionInvoked"/);
    expect(panel).toMatch(/function handleAvailableActionInvoked\(type: string\)/);
  });

  it("does not fire any RPC for action invocation in B3-1", () => {
    // The handler must remain a no-op until the backend's authoritative
    // action enum lands; the parent issue tracks the source-of-truth ticket.
    const fnMatch = panel.match(
      /function handleAvailableActionInvoked\(type: string\)\s*\{[\s\S]*?\n\}/,
    );
    expect(fnMatch, "handler must exist").not.toBeNull();
    const body = fnMatch![0];
    expect(body).not.toMatch(/fetch\(/);
    expect(body).not.toMatch(/api\//);
    expect(body).not.toMatch(/await /);
  });
});
