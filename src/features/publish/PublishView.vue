<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import type { PageChromeSpec } from "../../shell/page-model";
import {
  PUBLISH_SECTION_LABEL,
  PUBLISH_VIEW_POST,
} from "../../config/brand";
import { GlassPanel, InlineError, LianButton } from "../../ui";
import PublishActionBar from "./PublishActionBar.vue";
import PublishComposer from "./PublishComposer.vue";
import PublishLocationControls from "./PublishLocationControls.vue";
import PublishMetaControls from "./PublishMetaControls.vue";
import { usePublishDraft } from "./usePublishDraft";
import { usePublishLocationOptions } from "./usePublishLocationOptions";
import {
  clearPublishDraft,
  hasMeaningfulPublishDraft,
  readPublishDraft,
  restorePublishDraftLocation,
  savePublishDraft,
} from "./publishDraftSession";
import { usePublishSubmit } from "./usePublishSubmit";

const emit = defineEmits<{
  chrome: [spec: PageChromeSpec];
}>();

const RESET_CONFIRM_MESSAGE = [
  "当前发布内容还没有提交，确认清空吗？",
  "已选择的图片需要重新添加。",
].join("");

const draft = usePublishDraft();
const locationOptions = usePublishLocationOptions(draft.placeName);
const draftNotice = ref("");
const resetConfirmationVisible = ref(false);

function clearPublishState() {
  draft.resetForm(locationOptions.clearLocationState);
  clearPublishDraft();
  draftNotice.value = "";
  resetConfirmationVisible.value = false;
}

const { postDetailUrl, submitPublish } = usePublishSubmit({
  title: draft.title,
  body: draft.body,
  tagInput: draft.tagInput,
  identityTag: draft.identityTag,
  placeName: draft.placeName,
  visibility: draft.visibility,
  aliasId: draft.aliasId,
  uploadedImageUrls: draft.uploadedImageUrls,
  uploading: draft.uploading,
  publishing: draft.publishing,
  errorMessage: draft.errorMessage,
  successMessage: draft.successMessage,
  lastTid: draft.lastTid,
  normalizedTag: draft.normalizedTag,
  normalizedIdentityTag: draft.normalizedIdentityTag,
  selectedLocationDraft: locationOptions.selectedLocationDraft,
  locationPreviewLabel: locationOptions.locationPreviewLabel,
  validate: draft.validate,
  resetForm: clearPublishState,
});

const hasUnsavedDraft = computed(() =>
  hasMeaningfulPublishDraft({
    title: draft.title.value,
    body: draft.body.value,
    tagInput: draft.tagInput.value,
    placeName: draft.placeName.value,
    visibility: draft.visibility.value,
    selectedMapLocation: locationOptions.selectedMapLocation.value,
    selectedFileCount: draft.selectedFiles.value.length,
  }),
);

function persistPublishDraft() {
  savePublishDraft({
    title: draft.title.value,
    body: draft.body.value,
    tagInput: draft.tagInput.value,
    placeName: draft.placeName.value,
    visibility: draft.visibility.value,
    selectedMapLocation: locationOptions.selectedMapLocation.value,
    selectedFileCount: draft.selectedFiles.value.length,
  });
}

function restoreDraftFromSession() {
  const snapshot = readPublishDraft();
  if (!snapshot) return;

  draft.title.value = snapshot.title;
  draft.body.value = snapshot.body;
  draft.tagInput.value = snapshot.tagInput;
  draft.placeName.value = snapshot.placeName;
  draft.visibility.value = snapshot.visibility;
  locationOptions.selectedMapLocation.value =
    restorePublishDraftLocation(snapshot.selectedMapLocation);
  locationOptions.locationSearch.value =
    snapshot.selectedMapLocation?.name || snapshot.placeName;
  locationOptions.locationPanelOpen.value = Boolean(
    snapshot.selectedMapLocation || snapshot.placeName.trim(),
  );
  draftNotice.value = snapshot.pendingImageCount
    ? `已恢复同一会话中的未发布内容，${snapshot.pendingImageCount} 张图片需要重新选择。`
    : "已恢复同一会话中的未发布内容。";
}

function requestResetForm() {
  if (!hasUnsavedDraft.value) {
    clearPublishState();
    return;
  }

  resetConfirmationVisible.value = true;
  draft.errorMessage.value = "";
}

function cancelResetForm() {
  resetConfirmationVisible.value = false;
}

function confirmResetForm() {
  clearPublishState();
  draft.errorMessage.value = "";
  draft.successMessage.value = "";
}

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (!hasUnsavedDraft.value || draft.publishing.value) return;
  event.preventDefault();
  event.returnValue = "";
}

watch(draft.pageChrome, (spec) => emit("chrome", spec), {
  deep: true,
});

watch(
  [
    draft.title,
    draft.body,
    draft.tagInput,
    draft.placeName,
    draft.visibility,
    locationOptions.selectedMapLocation,
    () => draft.selectedFiles.value.length,
  ],
  persistPublishDraft,
);

watch(hasUnsavedDraft, (value) => {
  if (!value) resetConfirmationVisible.value = false;
});

onMounted(() => {
  emit("chrome", draft.pageChrome.value);
  restoreDraftFromSession();
  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", handleBeforeUnload);
  }
  void draft.loadIdentity();
  void locationOptions.loadMapLocations();
});

onBeforeUnmount(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("beforeunload", handleBeforeUnload);
  }
});
</script>

<template>
  <section
    class="publish-view keyboard-aware-surface"
    :aria-label="PUBLISH_SECTION_LABEL"
  >
    <GlassPanel class="publish-view__card">
      <InlineError v-if="draft.errorMessage.value">
        {{ draft.errorMessage.value }}
      </InlineError>
      <p
        v-if="draftNotice"
        class="publish-view__draft-notice"
        data-testid="publish-draft-notice"
      >
        {{ draftNotice }}
      </p>
      <div
        v-if="draft.successMessage.value"
        class="publish-view__success-block"
      >
        <p class="publish-view__success">{{ draft.successMessage.value }}</p>
        <a
          v-if="postDetailUrl"
          class="publish-view__view-post"
          :href="postDetailUrl"
          data-testid="publish-view-post-link"
        >
          {{ PUBLISH_VIEW_POST }}
        </a>
      </div>

      <form
        class="publish-view__form keyboard-aware-surface"
        @submit.prevent="submitPublish"
      >
        <PublishComposer
          :local-preview-urls="draft.localPreviewUrls.value"
          :image-status="draft.imageStatus.value"
          :title="draft.title.value"
          :body="draft.body.value"
          :uploading="draft.uploading.value"
          :publishing="draft.publishing.value"
          :title-count="draft.titleCount.value"
          :body-count="draft.bodyCount.value"
          :selected-files-count="draft.selectedFiles.value.length"
          :selected-map-location="locationOptions.selectedMapLocation.value"
          :place-name="draft.placeName.value"
          :normalized-tag="draft.normalizedTag.value"
          :normalized-identity-tag="draft.normalizedIdentityTag.value"
          :location-preview-label="locationOptions.locationPreviewLabel.value"
          :location-tool-label="locationOptions.locationToolLabel.value"
          :location-panel-open="locationOptions.locationPanelOpen.value"
          :tag-panel-open="draft.tagPanelOpen.value"
          :visibility-panel-open="draft.visibilityPanelOpen.value"
          :visibility-label="draft.visibilityLabel.value"
          @update:title="draft.title.value = $event"
          @update:body="draft.body.value = $event"
          @handle-files="draft.handleFiles"
          @remove-image="draft.removeImage"
          @toggle-location-panel="locationOptions.toggleLocationPanel"
          @toggle-tag-panel="draft.toggleTagPanel"
          @toggle-visibility-panel="draft.toggleVisibilityPanel"
        />

        <PublishLocationControls
          :panel-open="locationOptions.locationPanelOpen.value"
          :filtered-map-locations="locationOptions.filteredMapLocations.value"
          :selected-map-location="locationOptions.selectedMapLocation.value"
          :map-location-loading="locationOptions.mapLocationLoading.value"
          :map-location-error="locationOptions.mapLocationError.value"
          :location-search="locationOptions.locationSearch.value"
          :place-name="draft.placeName.value"
          :known-place-label="locationOptions.knownPlaceLabel.value"
          :location-preview-label="locationOptions.locationPreviewLabel.value"
          :location-binding-meta="locationOptions.locationBindingMeta.value"
          @update:location-search="locationOptions.locationSearch.value = $event"
          @update:place-name="draft.placeName.value = $event"
          @select-map-location="locationOptions.selectMapLocation"
          @clear-map-location="locationOptions.clearMapLocation"
          @load-map-locations="locationOptions.loadMapLocations"
        />

        <PublishMetaControls
          :tag-panel-open="draft.tagPanelOpen.value"
          :visibility-panel-open="draft.visibilityPanelOpen.value"
          :tag-input="draft.tagInput.value"
          :normalized-tag="draft.normalizedTag.value"
          :identity-tag="draft.identityTag.value"
          :identity-tag-options="draft.identityTagOptions.value"
          :visibility="draft.visibility.value"
          :visibility-options="draft.visibilityOptions"
          :visibility-label="draft.visibilityLabel.value"
          @update:tag-input="draft.tagInput.value = $event"
          @update:identity-tag="draft.identityTag.value = $event"
          @update:visibility="draft.visibility.value = $event"
        />

        <div
          v-if="resetConfirmationVisible"
          class="publish-view__reset-confirm"
          aria-live="polite"
          data-testid="publish-reset-confirm"
        >
          <p>{{ RESET_CONFIRM_MESSAGE }}</p>
          <div class="publish-view__reset-confirm-actions">
            <LianButton type="button" variant="ghost" @click="cancelResetForm">
              继续编辑
            </LianButton>
            <LianButton type="button" variant="danger" @click="confirmResetForm">
              确认清空
            </LianButton>
          </div>
        </div>

        <PublishActionBar
          :publishing="draft.publishing.value"
          :uploading="draft.uploading.value"
          :can-submit="draft.canSubmit.value"
          @reset-form="requestResetForm"
          @submit="submitPublish"
        />
      </form>
    </GlassPanel>
  </section>
</template>

<style scoped>
.publish-view,
.publish-view__card,
.publish-view__form {
  display: grid;
  gap: var(--space-4);
}

.publish-view {
  padding-top: calc(var(--floating-bar-height) + env(safe-area-inset-top));
  padding-bottom: calc(var(--space-8) + var(--keyboard-inset-bottom));
  scroll-padding-bottom: calc(var(--space-8) + var(--keyboard-inset-bottom));
}

.publish-view__form {
  scroll-padding-bottom: calc(var(--space-8) + var(--keyboard-inset-bottom));
}

.publish-view p {
  margin: 0;
}

.publish-view__card {
  gap: var(--space-5);
}

.publish-view__draft-notice {
  padding: var(--space-3) var(--space-4);
  border: 1px solid rgba(31, 167, 160, 0.18);
  border-radius: var(--radius-card);
  background: rgba(31, 167, 160, 0.1);
  color: var(--lian-ink);
  font-size: 14px;
  font-weight: 700;
}

.publish-view__success-block {
  display: grid;
  gap: var(--space-2);
}

.publish-view__success {
  color: var(--lian-primary);
  font-weight: 850;
  margin: 0;
}

.publish-view__view-post {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--lian-primary);
  font-size: 14px;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.publish-view__reset-confirm {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1px solid rgba(214, 78, 58, 0.18);
  border-radius: var(--radius-card);
  background: rgba(214, 78, 58, 0.08);
  color: var(--lian-ink);
}

.publish-view__reset-confirm p {
  font-size: 14px;
  font-weight: 700;
}

.publish-view__reset-confirm-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  justify-content: flex-end;
}
</style>
