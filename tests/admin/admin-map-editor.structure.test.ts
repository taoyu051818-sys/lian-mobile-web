import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), "utf8");

describe("authenticated Konva map editor structure", () => {
  it("mounts the editor only inside the ops-token admin lane", () => {
    const adminView = read("src/features/admin/AdminView.vue");
    expect(adminView).toMatch(/type AdminTabKey =[\s\S]*?"map"/);
    expect(adminView).toMatch(/<AdminMapEditorBlock[\s\S]*?:token="token"/);
    expect(adminView).toMatch(/v-else-if="activeTab === 'map'"/);
    expect(adminView.indexOf("<AdminMapEditorBlock")).toBeGreaterThan(
      adminView.indexOf("v-else-if=\"access.lane.value === 'ops'\""),
    );
  });

  it("uses one editable MapCanvas and exposes save, upload and delete actions", () => {
    const editor = read("src/features/admin/AdminMapEditorBlock.vue");
    expect(editor).toMatch(/useAdminMapApi/);
    expect(editor).not.toMatch(/\.\.\/\.\.\/api\//);
    expect(editor).toMatch(/<MapCanvas/);
    expect(editor).toMatch(/:editable="true"/);
    expect(editor).toMatch(/@object-change="handleObjectChange"/);
    expect(editor).toMatch(/@object-select="selectAsset"/);
    expect(editor).toMatch(/data-testid="admin-map-save"/);
    expect(editor).toMatch(/data-testid="admin-map-upload"/);
    expect(editor).toMatch(/data-testid="admin-map-delete"/);
    expect(editor).toMatch(/pendingReloadConfirmation/);
    expect(editor).toMatch(/pendingDeleteAssetId/);
    expect(editor).not.toMatch(/window\.confirm/);
    expect(editor).not.toMatch(/leaflet/i);
  });

  it("binds the selected Konva node to a Transformer", () => {
    const asset = read("src/features/map/MapSceneAsset.vue");
    expect(asset).toMatch(/Transformer/);
    expect(asset).toMatch(/transformerNode\.nodes\(\[assetNode\]\)/);
    expect(asset).toMatch(/onTransformend: handleTransformEnd/);
  });
});
