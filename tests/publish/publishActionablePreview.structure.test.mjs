import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8").replace(/\r\n/g, "\n");
}

function sectionBetween(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start + startToken.length);
  assert.ok(start > -1, `${startToken} should exist`);
  assert.ok(end > start, `${endToken} should follow ${startToken}`);
  return source.slice(start, end);
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

test("PublishView fingerprints every raw reset-owned publish field", () => {
  const src = read("src/features/publish/PublishView.vue");
  const submitWiring = sectionBetween(
    src,
    "usePublishSubmit({",
    "resetPublishAttemptForScopeTransition =",
  );

  assert.match(submitWiring, /draftOwnership:\s*\(\)\s*=>\s*\(\{/);
  assert.match(submitWiring, /selectedFileCount:\s*draft\.selectedFiles\.value\.length/);
  assert.match(submitWiring, /localPreviewUrls:\s*draft\.localPreviewUrls\.value/);
  assert.match(submitWiring, /uploadedImageUrls:\s*draft\.uploadedImageUrls\.value/);
  assert.match(submitWiring, /uploading:\s*draft\.uploading\.value/);
  for (const projection of [
    // Raw text and meta state. Normalized wire equality is deliberately insufficient.
    "draft.title.value",
    "draft.body.value",
    "draft.tagInput.value",
    "draft.identityTag.value",
    "draft.placeName.value",
    "draft.visibility.value",
    "draft.tagPanelOpen.value",
    "draft.visibilityPanelOpen.value",
    "draft.publishKind.value",
    // F2f-owned selection and upload lifecycle.
    "draft.selectedFiles.value.length",
    "draft.localPreviewUrls.value",
    "draft.uploadedImageUrls.value",
    "draft.uploading.value",
    // F2d location search, binding, selection, and panel lifecycle.
    "locationOptions.locationSearch.value",
    "locationOptions.mapPickerBinding.value",
    "locationOptions.selectedMapLocation.value",
    "locationOptions.selectedLocationDraft.value",
    "locationOptions.locationPanelOpen.value",
    // Event, Merchant, and Trade inputs cleared by the form reset.
    "eventDraft.postType.value",
    "eventDraft.startsAt.value",
    "eventDraft.endsAt.value",
    "eventDraft.capacity.value",
    "eventDraft.joinPolicy.value",
    "draft.merchant.name.value",
    "draft.merchant.category.value",
    "draft.merchant.hours.value",
    "draft.merchant.contact.value",
    "draft.merchant.errandSupported.value",
    "draft.trade.price.value",
    "draft.trade.state.value",
    "draft.trade.category.value",
    // F2b AI candidates cleared with the owning draft.
    "draft.llmInferredKind.value",
    "draft.titleCandidate.value",
    "draft.bodyCandidate.value",
    "draft.suggestedComponents.value",
  ]) {
    assert.ok(submitWiring.includes(projection), `draft ownership should include ${projection}`);
  }
});

test("manual form reset externally abandons the request before clearing draft state", () => {
  const src = read("src/features/publish/PublishView.vue");
  const clearState = sectionBetween(src, "function clearPublishState()", "const { postDetailUrl");
  const abandonIdx = clearState.indexOf("resetPublishAttempt();");
  const resetIdx = clearState.indexOf("draft.resetForm(");
  assert.ok(abandonIdx > -1, "manual clear should abandon the physical request owner");
  assert.ok(resetIdx > abandonIdx, "request abandon must happen before draft reset");

  const confirmReset = sectionBetween(
    src,
    "function confirmResetForm()",
    "async function handleFiles",
  );
  assert.match(confirmReset, /clearPublishState\(\);/);
});

test("PublishActionablePreview summarizes draft signals with Chinese labels", () => {
  const previewSrc = read("src/features/publish/PublishActionablePreview.vue");
  const brandSrc = read("src/config/brand/publish.ts");

  assert.match(brandSrc, /PUBLISH_ACTIONABLE_PREVIEW_TITLE = "发布结构预览"/);
  assert.match(brandSrc, /PUBLISH_ACTIONABLE_PREVIEW_WIRE_KIND = "发布为"/);
  assert.match(brandSrc, /PUBLISH_ACTIONABLE_PREVIEW_COMPONENTS = "待补充"/);
  assert.match(brandSrc, /PUBLISH_ACTIONABLE_PREVIEW_UNSTRUCTURED\s*=\s*"当前只会发布为自由文本/);

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
  assert.match(typeSrc, /components: Array<\{ kind: SuggestedComponentKind; label: string \}>/);
  assert.doesNotMatch(typeSrc, /actionablePost\??: PublishActionablePostPreview/);
  assert.doesNotMatch(apiSrc, /actionablePost:/);
  assert.match(submitSrc, /actionablePreview\?: Ref<PublishActionablePostPreview \| null>/);
  assert.match(submitSrc, /function createPublishActionablePostPreview/);
  assert.match(submitSrc, /components: SuggestedComponent\[\]/);
  assert.match(submitSrc, /components: input\.components\.map\(\(component\) => \(\{/);

  const eventSubmit = sectionBetween(
    submitSrc,
    "async function submitEvent()",
    "async function submitPublish()",
  );
  const postCapture = sectionBetween(
    submitSrc,
    "function capturePostSnapshotBase",
    "function captureEventSnapshot",
  );
  const eventCapture = sectionBetween(
    submitSrc,
    "function captureEventSnapshot",
    "function captureCurrentFingerprint",
  );
  const submitPublish = submitSrc.slice(submitSrc.indexOf("async function submitPublish()"));

  assert.match(
    postCapture,
    /suggestedComponents: draft\.suggestedComponents,[\s\S]*?components: draft\.suggestedComponents/,
  );
  assert.match(eventCapture, /createPublishActionablePostPreview\(\{[\s\S]*?kind:\s*"event"/);
  assert.match(postCapture, /createPublishActionablePostPreview\(\{[\s\S]*?kind,/);
  assert.match(postCapture, /locationArea:\s*request\.metadata\.locationArea \|\| ""/);
  assert.match(eventSubmit, /const submittedActionablePreview = snapshot\.preview/);
  assert.match(submitPublish, /const submittedActionablePreview = snapshot\.preview/);

  for (const [label, section] of [
    ["event", eventSubmit],
    ["post", submitPublish],
  ]) {
    const previewIdx = section.indexOf("const submittedActionablePreview");
    const resetIdx = section.indexOf("options.resetForm();", previewIdx);
    const assignmentIdx = section.indexOf(
      "options.actionablePreview.value = submittedActionablePreview",
      previewIdx,
    );
    assert.ok(previewIdx > -1, `${label} submit should capture its preview before reset`);
    assert.ok(resetIdx > previewIdx, `${label} submit should reset after capturing the preview`);
    assert.ok(
      assignmentIdx > resetIdx,
      `${label} submit should restore the captured preview after form reset`,
    );
  }
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
