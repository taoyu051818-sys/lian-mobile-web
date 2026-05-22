<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { PageChromeSpec } from "../../shell/page-model";
import {
  PUBLISH_SECTION_LABEL,
  PUBLISH_VIEW_POST,
  PUBLISH_CLEAR_CONFIRM,
  PUBLISH_IMAGE_RESELECT,
  PUBLISH_AI_PENDING,
  PUBLISH_AI_RISK_LABEL,
  PUBLISH_TYPE_LABEL,
  PUBLISH_TYPE_REGULAR,
  PUBLISH_TYPE_EVENT,
  PUBLISH_TYPE_MERCHANT,
  PUBLISH_TYPE_TRADE,
  PUBLISH_MERCHANT_GATE_TITLE,
  PUBLISH_MERCHANT_GATE_HINT,
  PUBLISH_MERCHANT_GATE_BLOCK,
  PUBLISH_MERCHANT_GATE_CTA,
} from "../../config/brand";
import { GlassPanel } from "../../ui";
import PublishActionBar from "./PublishActionBar.vue";
import PublishComposer from "./PublishComposer.vue";
import PublishLocationControls from "./PublishLocationControls.vue";
import PublishMetaControls from "./PublishMetaControls.vue";
import PublishEventControls from "./PublishEventControls.vue";
import PublishMerchantControls from "./PublishMerchantControls.vue";
import PublishTradeControls from "./PublishTradeControls.vue";
import PublishMessage from "./PublishMessage.vue";
import PublishGateNotice from "./PublishGateNotice.vue";
import { usePublishDraft } from "./usePublishDraft";
import { usePublishLocationOptions } from "./usePublishLocationOptions";
import { clearPublishDraft } from "./publishDraftSession";
import { usePublishDraftSession } from "./usePublishDraftSession";
import PublishResetConfirm from "./PublishResetConfirm.vue";
import { usePublishSubmit } from "./usePublishSubmit";
import { useEventPublishDraft } from "../../composables/useEventPublishDraft";
import { useActiveView } from "../../app/useActiveView";

const emit = defineEmits<{
  chrome: [spec: PageChromeSpec];
}>();

const RESET_CONFIRM_MESSAGE = [PUBLISH_CLEAR_CONFIRM, PUBLISH_IMAGE_RESELECT].join("");

const draft = usePublishDraft();
const eventDraft = useEventPublishDraft();
const locationOptions = usePublishLocationOptions(draft.placeName);
const resetConfirmationVisible = ref(false);
const { setActiveView } = useActiveView();
const merchantAffordanceLocked = computed(
  () => draft.merchant.verificationLoaded.value && !draft.merchant.merchantVerified.value,
);

function goToVerification() {
  setActiveView("verification");
}

function selectPublishKind(kind: "regular" | "event" | "merchant" | "trade") {
  if (kind === "merchant" && merchantAffordanceLocked.value) return;
  draft.publishKind.value = kind;
}

watch(
  draft.publishKind,
  (kind) => {
    if (kind === "merchant" && !draft.merchant.verificationLoaded.value) {
      void draft.merchant.refreshVerification();
    }
    if (kind === "trade" && !draft.trade.verificationLoaded.value) {
      void draft.trade.refreshVerification();
    }
  },
  { immediate: false },
);

watch(merchantAffordanceLocked, (locked) => {
  if (locked && draft.publishKind.value === "merchant") {
    draft.publishKind.value = "regular";
  }
});

// PR-3 (#813 follow-up): publishKind is now the single "what am I posting"
// decision. Keep eventDraft.postType in lock-step so the existing
// usePublishSubmit branch (postType === "event" -> createEvent) stays wired
// without the separate post-type chooser inside PublishEventControls.
watch(
  draft.publishKind,
  (kind) => {
    eventDraft.postType.value = kind === "event" ? "event" : "post";
  },
  { immediate: true },
);

const { draftNotice, hasUnsavedDraft, currentScope } = usePublishDraftSession({
  title: draft.title,
  body: draft.body,
  tagInput: draft.tagInput,
  placeName: draft.placeName,
  visibility: draft.visibility,
  selectedFiles: draft.selectedFiles,
  selectedMapLocation: locationOptions.selectedMapLocation,
  locationSearch: locationOptions.locationSearch,
  locationPanelOpen: locationOptions.locationPanelOpen,
  publishing: draft.publishing,
  loadIdentity: draft.loadIdentity,
  loadMapLocations: locationOptions.loadMapLocations,
  userId: draft.userId,
  identityLoaded: draft.identityLoaded,
});

function clearPublishState() {
  draft.resetForm(locationOptions.clearLocationState);
  eventDraft.reset();
  clearPublishDraft(currentScope.value);
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
  postType: eventDraft.postType,
  eventStartAt: eventDraft.startsAt,
  eventEndAt: eventDraft.endsAt,
  eventCapacity: eventDraft.capacity,
  eventJoinPolicy: eventDraft.joinPolicy,
  audienceVisibility: draft.visibility,
  publishKind: draft.publishKind,
  merchantPayload: () => draft.merchant.payload(),
  merchantVerified: draft.merchant.merchantVerified,
  tradePayload: () => draft.trade.payload(),
  tradeVerified: draft.trade.campusVerified,
});

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

async function handleFiles(event: Event) {
  await draft.handleFiles(event);
  // PRD §7.4.2 step 4: after the first successful upload, surface the
  // location step so the user picks a place (or skips) before AI returns.
  draft.notifyFirstUploadComplete(() => {
    if (!locationOptions.locationPanelOpen.value) {
      locationOptions.toggleLocationPanel();
    }
    if (!locationOptions.mapLocations.value.length) {
      void locationOptions.loadMapLocations();
    }
  });
}

watch(draft.pageChrome, (spec) => emit("chrome", spec), {
  deep: true,
});

watch(hasUnsavedDraft, (value) => {
  if (!value) resetConfirmationVisible.value = false;
});

onMounted(() => {
  emit("chrome", draft.pageChrome.value);
  if (!draft.merchant.verificationLoaded.value) {
    void draft.merchant.refreshVerification();
  }
});
</script>

<template>
  <section class="publish-view keyboard-aware-surface" :aria-label="PUBLISH_SECTION_LABEL">
    <GlassPanel class="publish-view__card">
      <PublishMessage v-if="draft.errorMessage.value" variant="error">
        {{ draft.errorMessage.value }}
      </PublishMessage>
      <PublishMessage v-if="draftNotice" variant="info" data-testid="publish-draft-notice">
        {{ draftNotice }}
      </PublishMessage>
      <PublishMessage v-if="draft.successMessage.value" variant="success">
        <p class="publish-view__success">{{ draft.successMessage.value }}</p>
        <a
          v-if="postDetailUrl"
          class="publish-view__view-post"
          :href="postDetailUrl"
          data-testid="publish-view-post-link"
        >
          {{ PUBLISH_VIEW_POST }}
        </a>
      </PublishMessage>

      <PublishMessage
        v-if="draft.aiLoading.value"
        variant="pending"
        data-testid="publish-ai-pending"
      >
        {{ PUBLISH_AI_PENDING }}
      </PublishMessage>
      <PublishMessage
        v-if="draft.aiRiskFlags.value.length"
        variant="warning"
        data-testid="publish-ai-risk-flags"
        :aria-label="PUBLISH_AI_RISK_LABEL"
      >
        <ul class="publish-message__list">
          <li v-for="(flag, idx) in draft.aiRiskFlags.value" :key="idx">
            {{ flag }}
          </li>
        </ul>
      </PublishMessage>

      <form class="publish-view__form keyboard-aware-surface" @submit.prevent="submitPublish">
        <fieldset
          class="publish-view__type-switch"
          :aria-label="PUBLISH_TYPE_LABEL"
          data-testid="publish-type-switch"
        >
          <legend>{{ PUBLISH_TYPE_LABEL }}</legend>
          <label
            class="publish-view__type-option"
            :class="{ 'is-active': draft.publishKind.value === 'regular' }"
          >
            <input
              type="radio"
              name="publish-kind"
              value="regular"
              :checked="draft.publishKind.value === 'regular'"
              @change="selectPublishKind('regular')"
            />
            <span>{{ PUBLISH_TYPE_REGULAR }}</span>
          </label>
          <label
            class="publish-view__type-option"
            :class="{ 'is-active': draft.publishKind.value === 'event' }"
          >
            <input
              type="radio"
              name="publish-kind"
              value="event"
              data-testid="publish-type-event"
              :checked="draft.publishKind.value === 'event'"
              @change="selectPublishKind('event')"
            />
            <span>{{ PUBLISH_TYPE_EVENT }}</span>
          </label>
          <label
            class="publish-view__type-option"
            :class="{
              'is-active': draft.publishKind.value === 'merchant',
              'is-disabled': merchantAffordanceLocked,
            }"
          >
            <input
              type="radio"
              name="publish-kind"
              value="merchant"
              data-testid="publish-type-merchant"
              :checked="draft.publishKind.value === 'merchant'"
              :disabled="merchantAffordanceLocked"
              @change="selectPublishKind('merchant')"
            />
            <span>{{ PUBLISH_TYPE_MERCHANT }}</span>
          </label>
          <label
            class="publish-view__type-option"
            :class="{ 'is-active': draft.publishKind.value === 'trade' }"
          >
            <input
              type="radio"
              name="publish-kind"
              value="trade"
              data-testid="publish-type-trade"
              :checked="draft.publishKind.value === 'trade'"
              @change="selectPublishKind('trade')"
            />
            <span>{{ PUBLISH_TYPE_TRADE }}</span>
          </label>
        </fieldset>

        <PublishGateNotice
          v-if="merchantAffordanceLocked"
          data-testid="publish-merchant-affordance-gate"
          :title="PUBLISH_MERCHANT_GATE_TITLE"
          :cta-label="PUBLISH_MERCHANT_GATE_CTA"
          @cta="goToVerification"
        >
          <p>{{ PUBLISH_MERCHANT_GATE_HINT }}</p>
          <p class="publish-gate-notice__block">{{ PUBLISH_MERCHANT_GATE_BLOCK }}</p>
        </PublishGateNotice>

        <PublishEventControls
          v-if="draft.publishKind.value === 'event'"
          :starts-at="eventDraft.startsAt.value"
          :ends-at="eventDraft.endsAt.value"
          :capacity="eventDraft.capacity.value"
          :join-policy="eventDraft.joinPolicy.value"
          @update:starts-at="eventDraft.startsAt.value = $event"
          @update:ends-at="eventDraft.endsAt.value = $event"
          @update:capacity="eventDraft.capacity.value = $event"
          @update:join-policy="eventDraft.joinPolicy.value = $event"
        />

        <PublishMerchantControls
          v-if="draft.publishKind.value === 'merchant'"
          :merchant-verified="draft.merchant.merchantVerified.value"
          :verification-loaded="draft.merchant.verificationLoaded.value"
          :name="draft.merchant.name.value"
          :category="draft.merchant.category.value"
          :hours="draft.merchant.hours.value"
          :contact="draft.merchant.contact.value"
          :errand-supported="draft.merchant.errandSupported.value"
          @update:name="draft.merchant.name.value = $event"
          @update:category="draft.merchant.category.value = $event"
          @update:hours="draft.merchant.hours.value = $event"
          @update:contact="draft.merchant.contact.value = $event"
          @update:errand-supported="draft.merchant.errandSupported.value = $event"
          @go-verify="goToVerification"
        />

        <PublishTradeControls
          v-if="draft.publishKind.value === 'trade'"
          :campus-verified="draft.trade.campusVerified.value"
          :verification-loaded="draft.trade.verificationLoaded.value"
          :price="draft.trade.price.value"
          :state="draft.trade.state.value"
          :category="draft.trade.category.value"
          @update:price="draft.trade.price.value = $event"
          @update:state="draft.trade.state.value = $event"
          @update:category="draft.trade.category.value = $event"
          @go-verify="goToVerification"
        />
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
          @handle-files="handleFiles"
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
          :is-visibility-allowed="draft.isVisibilityAllowed"
          :visibility-disabled-reason="draft.visibilityDisabledReason"
          @update:tag-input="draft.tagInput.value = $event"
          @update:identity-tag="draft.identityTag.value = $event"
          @update:visibility="draft.visibility.value = $event"
        />

        <PublishResetConfirm
          :visible="resetConfirmationVisible"
          :message="RESET_CONFIRM_MESSAGE"
          @cancel="cancelResetForm"
          @confirm="confirmResetForm"
        />

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

/* Banner / hint container styling lives in PublishMessage.vue
 * (variants: error / warning / info / success / pending). Only inner
 * typography that PublishView still owns (success copy + view-post link)
 * survives here.
 */

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

.publish-view__type-switch {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: var(--space-3);
  margin: 0;
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: calc(var(--radius-card) + 2px);
  background: rgba(255, 255, 255, 0.56);
}

.publish-view__type-switch legend {
  width: 100%;
  margin-bottom: 4px;
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.publish-view__type-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px var(--space-3);
  border: 1px solid rgba(31, 41, 51, 0.12);
  border-radius: var(--radius-chip, 999px);
  background: rgba(255, 255, 255, 0.74);
  color: var(--lian-ink);
  font-weight: 700;
  cursor: pointer;
}

.publish-view__type-option input {
  accent-color: var(--lian-primary, #1fa7a0);
}

.publish-view__type-option.is-active {
  border-color: rgba(31, 167, 160, 0.35);
  background: rgba(31, 167, 160, 0.14);
}

.publish-view__type-option.is-disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.publish-view__type-option.is-disabled input {
  cursor: not-allowed;
}

/* Affordance-gate styling lives in PublishGateNotice.vue
 * (variants: title / hint / block / CTA). The merchant-affordance gate
 * shares that primitive with PublishTradeControls and the merchant /
 * trade in-form gates.
 */
</style>
