<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { PageChromeSpec } from "../../shell/page-model";
import {
  PUBLISH_AUTH_GATE_CTA,
  PUBLISH_AUTH_GATE_HINT,
  PUBLISH_AUTH_GATE_TITLE,
  PUBLISH_SECTION_LABEL,
  PUBLISH_VIEW_POST,
  PUBLISH_CLEAR_CONFIRM,
  PUBLISH_IMAGE_RESELECT,
  PUBLISH_AI_PENDING,
  PUBLISH_AI_RISK_LABEL,
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

// Auth gate: detect guest state after identity loads
const isGuest = computed(() => draft.identityLoaded.value && !draft.userId.value);

function goLogin() {
  setActiveView("profile");
}

function goToVerification() {
  setActiveView("verification");
}

// PRD V0.2 step F (§2.2 / §6 step F) — the 4-radio "publishKind" fieldset is
// gone. Kind is now inferred at submit time from the draft snapshot
// (`inferKind` in usePublishSubmit). The `publishKind` ref still exists and
// is mutated by `accept(suggestedComponent)` ghosts (event_time / merchant_info
// / trade_condition / price), so the merchant / trade / event panels keep
// their v-if gates and the createEvent branch in usePublishSubmit keeps
// firing — the watches below preserve all that wiring.
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

// Defense-in-depth: if a merchant loses verification mid-session (e.g. the
// merchant_verified record is revoked while the user has the merchant panel
// open via `accept(merchant_info)`), reset publishKind to "regular" so the
// form doesn't sit on a panel the actor can't satisfy. The accept action
// itself already gates on the verification flag (see
// createSuggestedComponentsActions in usePublishDraft); this is a second
// layer that catches mid-session drops.
watch(draft.merchant.merchantVerified, (verified) => {
  if (!verified && draft.publishKind.value === "merchant") {
    draft.publishKind.value = "regular";
  }
});

// PR-3 (#813 follow-up) — keep eventDraft.postType in lock-step with
// publishKind so usePublishSubmit's createEvent branch (postType === "event")
// stays wired without a separate post-type chooser inside
// PublishEventControls. Step F doesn't change this contract; the only
// difference is publishKind now becomes "event" via `accept(event_time)`
// instead of a radio click.
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
  llmInferredKind: draft.llmInferredKind,
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
  <section
    class="publish-view keyboard-aware-surface"
    :aria-label="PUBLISH_SECTION_LABEL"
    data-testid="publish-card"
  >
    <!-- Auth gate: redirect guests to profile for login -->
    <section
      v-if="isGuest"
      class="publish-view__auth-gate"
      :aria-label="PUBLISH_AUTH_GATE_TITLE"
      data-testid="publish-auth-gate"
    >
      <strong>{{ PUBLISH_AUTH_GATE_TITLE }}</strong>
      <p>{{ PUBLISH_AUTH_GATE_HINT }}</p>
      <button
        type="button"
        class="publish-view__auth-gate-cta"
        data-testid="publish-auth-gate-cta"
        @click="goLogin"
      >
        {{ PUBLISH_AUTH_GATE_CTA }}
      </button>
    </section>

    <GlassPanel v-else class="publish-view__card">
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
          :uploaded-image-count="draft.uploadedImageUrls.value.length"
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

/* Affordance-gate styling lives in PublishGateNotice.vue
 * (variants: title / hint / block / CTA). The merchant-affordance gate
 * shares that primitive with PublishTradeControls and the merchant /
 * trade in-form gates.
 */

.publish-view__auth-gate {
  display: grid;
  gap: var(--space-3);
  max-width: 420px;
  margin: var(--space-6) auto 0;
  padding: var(--space-4);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: var(--lian-card-strong);
  box-shadow: var(--shadow-card);
}

.publish-view__auth-gate strong {
  font-size: 16px;
  font-weight: 900;
}

.publish-view__auth-gate p {
  margin: 0;
  color: var(--lian-muted);
  font-size: 13px;
  line-height: 1.5;
}

.publish-view__auth-gate-cta {
  justify-self: start;
  appearance: none;
  border: 0;
  border-radius: var(--radius-chip, 999px);
  background: var(--lian-primary, #1fa7a0);
  color: white;
  font-weight: 800;
  height: 40px;
  padding: 0 var(--space-4);
  cursor: pointer;
}
</style>
