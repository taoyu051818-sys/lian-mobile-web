<script setup lang="ts">
import { computed } from "vue";
import type { EventActionPlan } from "../../domain/eventActionPolicy";
import type { HelpManagePlan } from "../../domain/helpManagePolicy";
import type { HelpVotePlan } from "../../domain/helpVotePolicy";
import type { MerchantErrandUnavailableReason } from "../../types/merchant";
import type { PlaceRef, PlaceSheet } from "../../types/place";
import type { PostType } from "../../types/post";
import type { AudienceVisibility } from "../../types/audience";
import type {
  EventPostExtension,
  HelpPostExtension,
  MerchantPostExtension,
  TradePostExtension,
} from "../../types/post-extensions";
import type { PostDetailMetadataV2 } from "../../types/post";
import {
  resolvePostCapabilities,
  type PostCapabilityId,
  type PostCapabilitySelection,
} from "./postCapabilityRegistry";
import { isPostActionAvailable, type PostActionContext } from "./postActionRegistry";
import PostActionFeedback from "./PostActionFeedback.vue";
import PostComponentsSlot from "./PostComponentsSlot.vue";
import PostDetailEventBlock from "./PostDetailEventBlock.vue";
import PostDetailGallery from "./PostDetailGallery.vue";
import PostDetailHelpBlock from "./PostDetailHelpBlock.vue";
import PostDetailHelpManageBlock from "./PostDetailHelpManageBlock.vue";
import PostDetailInfoStrip from "./PostDetailInfoStrip.vue";
import PostDetailMainBody from "./PostDetailMainBody.vue";
import PostDetailMerchantBlock from "./PostDetailMerchantBlock.vue";
import PostDetailTradeBlock from "./PostDetailTradeBlock.vue";
import PostDetailTypedFallbackBlock from "./PostDetailTypedFallbackBlock.vue";
import PostPlaceSheetBlock from "./PostPlaceSheetBlock.vue";
import PostReportBlock from "./PostReportBlock.vue";

const props = defineProps<{
  title?: string;
  bodyHtml?: string;
  images?: string[];
  primaryTag?: string;
  timeLabel?: string;
  placeLabel?: string;
  placeStatusText?: string;
  structuredPlace?: PlaceRef | null;
  placeSheetOpen?: boolean;
  placeSheet?: PlaceSheet | null;
  placeSheetLoading?: boolean;
  placeSheetError?: string;
  reportOpen?: boolean;
  reportBusy?: boolean;
  reportCategory?: string;
  reportCategories?: Array<{ value: string; label: string }>;
  reportReason?: string;
  reportReasonVisible?: boolean;
  reportReasonPlaceholder?: string;
  reportFollowUpVisible?: boolean;
  actionError?: string;
  actionMessage?: string;
  postType?: PostType;
  event?: EventPostExtension;
  eventPlan?: EventActionPlan;
  eventBusy?: boolean;
  eventActionError?: string;
  eventManageable?: boolean;
  eventCompleteBusy?: boolean;
  eventCompleteActionError?: string;
  help?: HelpPostExtension;
  helpPlan?: HelpVotePlan;
  helpBusy?: boolean;
  helpActionError?: string;
  helpManagePlan?: HelpManagePlan;
  helpManageBusy?: boolean;
  helpManageActionError?: string;
  merchant?: MerchantPostExtension;
  errandEntryAvailable?: boolean;
  merchantPostId?: number;
  errandUnavailableReason?: MerchantErrandUnavailableReason | "";
  errandUnavailableReasonText?: string;
  /**
   * Apple-gap wave 3-A (mw#827) capability gate. When the parent surface
   * already knows the viewer cannot place an errand order (e.g. anonymous
   * viewer, not yet campus_verified), passing `false` flips the merchant
   * CTA into the `disabled-permission` state without changing layout.
   * Defaults to `true` — surfaces that have not opted into the gate keep
   * working byte-identically.
   */
  viewerCanOrderErrand?: boolean;
  trade?: TradePostExtension;
  visibility?: AudienceVisibility;
  /**
   * PRD V0.3 §2.1.3 — V2 components block. Forwarded straight to
   * PostComponentsSlot; the slot looks up renderers in
   * `postComponentRegistry` and silently skips unregistered types so future
   * component additions (delivery / groupbuy / channel / ledger) can land
   * without widening this component's prop set.
   */
  metadata?: PostDetailMetadataV2;
}>();

// Issue #785 — single capability lookup. The view used to ladder
// `v-if="event && eventPlan"` / `v-else-if="postType === 'event'"` etc.; the
// registry consolidates that selection so adding a new capability does not
// widen these conditionals. Adapters in `api/posts.ts` still own raw
// normalization — we read already-normalized fields here. Structured place
// content intentionally stays on the separate `PostPlaceSheetBlock` path for
// now (issue #794), so it is not part of the registry-backed capability set.
const capabilityResolutions = computed(() =>
  resolvePostCapabilities({
    type: props.postType,
    event: props.event,
    help: props.help,
    merchant: props.merchant,
    trade: props.trade,
  }),
);

function selectionFor(id: PostCapabilityId): PostCapabilitySelection {
  return capabilityResolutions.value.find((entry) => entry.id === id)?.selection ?? "skip";
}

// Issue #793 — keep block rendering on the capability path, but centralize
// which action surfaces are available for the already-rendered blocks.
const actionContext = computed<PostActionContext>(() => ({
  type: props.postType,
  viewer: {
    canManageEvent: Boolean(props.eventManageable),
    canManageHelp: Boolean(props.helpManagePlan?.canManage),
    canManageTrade: false,
  },
  event: props.event,
  help: props.help,
  merchant: props.merchant,
  trade: props.trade,
  errandEntryAvailable: props.errandEntryAvailable,
  reportFollowUpVisible: props.reportFollowUpVisible,
}));

const showEventBlock = computed(
  () => selectionFor("event") === "render" && Boolean(props.eventPlan),
);
const showEventAction = computed(
  () => isPostActionAvailable("event-act", actionContext.value) && Boolean(props.eventPlan),
);
const showEventCompleteAction = computed(() =>
  isPostActionAvailable("event-complete", actionContext.value),
);
const showEventFallback = computed(() => selectionFor("event") === "fallback");

const showHelpBlock = computed(() => selectionFor("help") === "render" && Boolean(props.helpPlan));
const showHelpAction = computed(
  () => isPostActionAvailable("help-act", actionContext.value) && Boolean(props.helpPlan),
);
const showHelpLinkedEvent = computed(() =>
  isPostActionAvailable("help-open-linked-event", actionContext.value),
);
const showHelpFallback = computed(() => selectionFor("help") === "fallback");

const showHelpManageLinkEvent = computed(
  () =>
    Boolean(props.helpManagePlan) && isPostActionAvailable("help-link-event", actionContext.value),
);
const showHelpManageUnlinkEvent = computed(
  () =>
    Boolean(props.helpManagePlan) &&
    isPostActionAvailable("help-unlink-event", actionContext.value),
);
const showHelpManageResolve = computed(
  () => Boolean(props.helpManagePlan) && isPostActionAvailable("help-resolve", actionContext.value),
);
const showHelpManageClose = computed(
  () => Boolean(props.helpManagePlan) && isPostActionAvailable("help-close", actionContext.value),
);
const showHelpManageBlock = computed(
  () =>
    showHelpManageLinkEvent.value ||
    showHelpManageUnlinkEvent.value ||
    showHelpManageResolve.value ||
    showHelpManageClose.value,
);

const showMerchantBlock = computed(() => selectionFor("merchant") === "render");
const showMerchantErrandAction = computed(() =>
  isPostActionAvailable("merchant-errand", actionContext.value),
);
const showMerchantFallback = computed(() => selectionFor("merchant") === "fallback");
const showTradeBlock = computed(() => selectionFor("trade") === "render");
const showTradeFallback = computed(() => selectionFor("trade") === "fallback");

const emit = defineEmits<{
  galleryPointerDown: [event: PointerEvent];
  galleryPointerMove: [event: PointerEvent];
  openGalleryImage: [index: number];
  openPlaceSheet: [];
  toggleReport: [];
  submitReport: [];
  hideReportedPost: [];
  eventAct: [];
  eventComplete: [];
  helpAct: [];
  helpOpenLinkedEvent: [tid: number];
  helpManageLinkEvent: [eventTid: number];
  helpManageUnlinkEvent: [];
  helpManageResolve: [];
  helpManageClose: [];
  "update:reportCategory": [value: string];
  "update:reportReason": [value: string];
  "update:placeSheetOpen": [value: boolean];
}>();
</script>

<template>
  <div class="post-detail-content__body">
    <PostDetailGallery
      :images="images"
      :title="title"
      @gallery-pointer-down="emit('galleryPointerDown', $event)"
      @gallery-pointer-move="emit('galleryPointerMove', $event)"
      @open-gallery-image="emit('openGalleryImage', $event)"
    />

    <PostDetailMainBody :title="title" :body-html="bodyHtml" />

    <PostDetailEventBlock
      v-if="showEventBlock"
      :event="event!"
      :plan="eventPlan!"
      :busy="!!eventBusy"
      :action-error="eventActionError"
      :manageable="!!eventManageable"
      :complete-busy="!!eventCompleteBusy"
      :complete-action-error="eventCompleteActionError"
      :show-action="showEventAction"
      :show-complete-action="showEventCompleteAction"
      @act="emit('eventAct')"
      @complete="emit('eventComplete')"
    />
    <PostDetailTypedFallbackBlock v-else-if="showEventFallback" post-type="event" />

    <PostDetailHelpBlock
      v-if="showHelpBlock"
      :help="help!"
      :plan="helpPlan!"
      :busy="!!helpBusy"
      :action-error="helpActionError"
      :show-action="showHelpAction"
      :show-linked-entry="showHelpLinkedEvent"
      @act="emit('helpAct')"
      @open-linked-event="emit('helpOpenLinkedEvent', $event)"
    />
    <PostDetailTypedFallbackBlock v-else-if="showHelpFallback" post-type="help" />

    <PostDetailHelpManageBlock
      v-if="showHelpManageBlock"
      :plan="helpManagePlan!"
      :busy="!!helpManageBusy"
      :action-error="helpManageActionError"
      :show-link-event="showHelpManageLinkEvent"
      :show-unlink-event="showHelpManageUnlinkEvent"
      :show-resolve="showHelpManageResolve"
      :show-close="showHelpManageClose"
      @link-event="emit('helpManageLinkEvent', $event)"
      @unlink-event="emit('helpManageUnlinkEvent')"
      @resolve="emit('helpManageResolve')"
      @close="emit('helpManageClose')"
    />

    <PostDetailMerchantBlock
      v-if="showMerchantBlock"
      :merchant="merchant!"
      :errand-entry-available="errandEntryAvailable"
      :merchant-post-id="merchantPostId"
      :errand-unavailable-reason="errandUnavailableReason"
      :errand-unavailable-reason-text="errandUnavailableReasonText"
      :show-errand-action="showMerchantErrandAction"
      :viewer-can-order-errand="viewerCanOrderErrand"
    />
    <PostDetailTypedFallbackBlock v-else-if="showMerchantFallback" post-type="merchant" />

    <PostDetailTradeBlock v-if="showTradeBlock" :trade="trade!" />
    <PostDetailTypedFallbackBlock v-else-if="showTradeFallback" post-type="trade" />

    <PostDetailInfoStrip
      :primary-tag="primaryTag"
      :time-label="timeLabel"
      :place-label="placeLabel"
      :place-status-text="placeStatusText"
      :structured-place="structuredPlace"
      :place-sheet-open="placeSheetOpen"
      :report-open="reportOpen"
      :report-busy="reportBusy"
      :visibility="visibility"
      @open-place-sheet="emit('openPlaceSheet')"
      @toggle-report="emit('toggleReport')"
    />

    <PostPlaceSheetBlock
      :place-sheet-open="placeSheetOpen"
      :structured-place="structuredPlace"
      :place-sheet="placeSheet"
      :place-sheet-loading="placeSheetLoading"
      :place-sheet-error="placeSheetError"
      :place-label="placeLabel"
      :place-status-text="placeStatusText"
      @open-place-sheet="emit('openPlaceSheet')"
      @update:place-sheet-open="emit('update:placeSheetOpen', $event)"
    />

    <PostReportBlock
      :report-open="reportOpen"
      :report-busy="reportBusy"
      :report-category="reportCategory"
      :report-categories="reportCategories"
      :report-reason="reportReason"
      :report-reason-visible="reportReasonVisible"
      :report-reason-placeholder="reportReasonPlaceholder"
      :report-follow-up-visible="reportFollowUpVisible"
      @submit-report="emit('submitReport')"
      @hide-reported-post="emit('hideReportedPost')"
      @update:report-category="emit('update:reportCategory', $event)"
      @update:report-reason="emit('update:reportReason', $event)"
    />

    <PostActionFeedback :action-error="actionError" :action-message="actionMessage" />
  </div>
</template>
