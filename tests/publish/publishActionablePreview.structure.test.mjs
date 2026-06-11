import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

test("PublishView renders an actionable post structure preview from the publish draft", () => {
  const src = read("src/features/publish/PublishView.vue");

  assert.match(src, /import PublishActionablePreview from "\.\/PublishActionablePreview\.vue"/);
  assert.match(src, /<PublishActionablePreview[\s\S]*?:kind="draft\.publishKind\.value"/);
  assert.match(src, /:suggested-components="draft\.suggestedComponents\.value"/);
  assert.match(src, /:merchant-name="draft\.merchant\.name\.value"/);
  assert.match(src, /:trade-price="draft\.trade\.price\.value"/);
  assert.match(src, /:event-starts-at="eventDraft\.startsAt\.value"/);
  assert.match(src, /:event-join-policy="eventDraft\.joinPolicy\.value"/);
  assert.match(src, /:llm-inferred-kind="draft\.llmInferredKind\.value"/);
  assert.match(src, /:uploaded-image-count="draft\.uploadedImageUrls\.value\.length"/);

  const composerIdx = src.search(/<PublishComposer/);
  const previewIdx = src.search(/<PublishActionablePreview/);
  const actionBarIdx = src.search(/<PublishActionBar/);

  assert.ok(composerIdx > -1, "PublishComposer must be mounted");
  assert.ok(previewIdx > composerIdx, "preview should appear after the freeform composer");
  assert.ok(actionBarIdx > previewIdx, "preview should appear before final publish actions");
  assert.ok(
    src.search(/<PublishLocationControls/) < previewIdx,
    "preview should include location control state before publishing",
  );
  assert.ok(
    src.search(/<PublishMetaControls/) < previewIdx,
    "preview should include tag and identity settings before publishing",
  );
});

test("PublishActionablePreview summarizes draft signals with Chinese labels", () => {
  const previewSrc = read("src/features/publish/PublishActionablePreview.vue");
  const brandSrc = read("src/config/brand/publish.ts");

  assert.match(brandSrc, /PUBLISH_ACTIONABLE_PREVIEW_TITLE = "发布结构预览"/);
  assert.match(brandSrc, /PUBLISH_ACTIONABLE_PREVIEW_WIRE_KIND = "发布为"/);
  assert.match(brandSrc, /PUBLISH_ACTIONABLE_PREVIEW_COMPONENTS = "待补充"/);
  assert.match(
    brandSrc,
    /PUBLISH_ACTIONABLE_PREVIEW_UNSTRUCTURED =\s*\n?\s*"当前只会发布为自由文本/,
  );

  assert.match(previewSrc, /data-testid="publish-preview-wire-kind"/);
  assert.match(previewSrc, /props\.normalizedTag\.replace\(\/\^#\+\/, ""\) === "求助"/);
  assert.match(previewSrc, /if \(props\.uploadedImageCount > 0\) return "图片"/);
  assert.match(previewSrc, /if \(props\.llmInferredKind === "event"\) return "活动"/);
  assert.match(previewSrc, /if \(hasLocation\.value && !props\.body\.trim\(\)\) return "地点"/);
  assert.match(previewSrc, /data-testid="publish-preview-location"/);
  assert.match(previewSrc, /data-testid="publish-preview-event"/);
  assert.match(previewSrc, /data-testid="publish-preview-merchant"/);
  assert.match(previewSrc, /data-testid="publish-preview-trade"/);
  assert.match(previewSrc, /data-testid="publish-preview-component"/);
});
test("publish success threads front-end-only actionable post structure into preview", () => {
  const typeSrc = read("src/types/publish.ts");
  const apiSrc = read("src/api/publish.ts");
  const submitSrc = read("src/features/publish/usePublishSubmit.ts");
  const viewSrc = read("src/features/publish/PublishView.vue");
  const previewSrc = read("src/features/publish/PublishActionablePreview.vue");
  const brandSrc = read("src/config/brand/publish.ts");

  assert.match(typeSrc, /export interface PublishActionablePostPreview/);
  assert.doesNotMatch(typeSrc, /actionablePost\??: PublishActionablePostPreview/);
  assert.doesNotMatch(apiSrc, /actionablePost:/);
  assert.match(submitSrc, /actionablePreview: Ref<PublishActionablePostPreview \| null>/);
  assert.match(submitSrc, /function createPublishActionablePostPreview/);
  assert.match(
    submitSrc,
    /const submittedActionablePreview = createPublishActionablePostPreview\([\s\S]*?kind: "event"[\s\S]*?options\.resetForm\(\);\n\s*options\.actionablePreview\.value = submittedActionablePreview/,
  );
  assert.match(
    submitSrc,
    /const submittedActionablePreview = createPublishActionablePostPreview\([\s\S]*?kind,[\s\S]*?locationArea: payload\.metadata\.locationArea \|\| ""[\s\S]*?options\.resetForm\(\);\n\s*options\.actionablePreview\.value = submittedActionablePreview/,
  );
  assert.match(
    viewSrc,
    /const actionablePreview = ref<PublishActionablePostPreview \| null>\(null\)/,
  );
  assert.match(viewSrc, /actionablePreview\.value = null/);
  assert.match(viewSrc, /actionablePreview,/);
  assert.match(viewSrc, /:actionable-post="actionablePreview"/);
  assert.match(previewSrc, /actionablePost: PublishActionablePostPreview \| null/);
  assert.match(previewSrc, /data-testid="publish-preview-action"/);
  assert.match(previewSrc, /data-testid="publish-preview-published-structure"/);
  assert.match(brandSrc, /PUBLISH_ACTIONABLE_PREVIEW_ACTION = "行动"/);
  assert.match(brandSrc, /PUBLISH_ACTIONABLE_PREVIEW_PUBLISHED = "将发布为"/);
});
