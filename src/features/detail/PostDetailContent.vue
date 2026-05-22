<script setup lang="ts">
import { computed } from "vue";
import type { PlaceRef, PlaceSheet } from "../../types/place";
import type { PostType } from "../../types/post";
import type { EventActionPlan } from "../../domain/eventActionPolicy";
import type { HelpVotePlan } from "../../domain/helpVotePolicy";
import type { HelpManagePlan } from "../../domain/helpManagePolicy";
import type { MerchantErrandUnavailableReason } from "../../types/merchant";
import type {
  EventPostExtension,
  HelpPostExtension,
  MerchantPostExtension,
  TradePostExtension,
} from "../../types/post-extensions";
import {
  resolvePostCapabilities,
  type PostCapabilityId,
  type PostCapabilitySelection,
} from "./postCapabilityRegistry";
import { isPostActionAvailable, type PostActionContext } from "./postActionRegistry";
import PostDetailGallery from "./PostDetailGallery.vue";
import PostDetailMainBody from "./PostDetailMainBody.vue";
import PostDetailInfoStrip from "./PostDetailInfoStrip.vue";
import PostDetailEventBlock from "./PostDetailEventBlock.vue";
import PostDetailHelpBlock from "./PostDetailHelpBlock.vue";
import PostDetailHelpManageBlock from "./PostDetailHelpManageBlock.vue";
import PostDetailMerchantBlock from "./PostDetailMerchantBlock.vue";
import PostDetailTradeBlock from "./PostDetailTradeBlock.vue";
import PostDetailTypedFallbackBlock from "./PostDetailTypedFallbackBlock.vue";
import PostPlaceSheetBlock from "./PostPlaceSheetBlock.vue";
import PostReportBlock from "./PostReportBlock.vue";
import PostActionFeedback from "./PostActionFeedback.vue";

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
  trade?: TradePostExtension;
  /**
   * Viewer-side role flags consumed by the post-action registry. The panel
   * already derives these (`usePostDetailExtensions` for event,
   * `helpManageable` from PostDetail) so we just forward them here instead of
   * re-deriving anything view-side. Trade-side manage gating lives on the
   * sibling `PostDetailTradeManageBlock` so it is not re-exposed here.
   */
  canManageEvent?: boolean;
  canManageHelp?: boolean;
}>();

// Issue #785 — single capability lookup. The view used to ladder
// `v-if="event && eventPlan"` / `v-else-if="postType === 'event'"` etc.; the
// registry consolidates that selection so adding a new capability does not
// widen these conditionals. Adapters in `api/posts.ts` still own raw
// normalization — we read already-normalized fields here.
const capabilityResolutions = computed(() =>
  resolvePostCapabilities({
    type: props.postType,
    event: props.event,
    help: props.help,
    merchant: props.merchant,
    trade: props.trade,
    place: props.structuredPlace ?? undefined,
  }),
);

function selectionFor(id: PostCapabilityId): PostCapabilitySelection {
  return capabilityResolutions.value.find((entry) => entry.id === id)?.selection ?? "skip";
}

// Issue #793 — single action lookup. The view used to gate per-button visibility
// on a mix of inline `v-if` truthy guards (event/help plan, helpManagePlan,
// merchant errand entry, report follow-up); the registry consolidates that
// gating so adding a future action does not widen these conditionals.
const actionContext = computed<PostActionContext>(() => ({
  type: props.postType,
  viewer: {
    canManageEvent: Boolean(props.canManageEvent),
    canManageHelp: Boolean(props.canManageHelp),
    canManageTrade: false,
  },
  event: props.event,
  help: props.help,
  merchant: props.merchant,
  trade: props.trade,
  errandEntryAvailable: props.errandEntryAvailable,
  reportFollowUpVisible: props.reportFollowUpVisible,
}));

const showEventAct = computed(
  () => isPostActionAvailable("event-act", actionContext.value) && Boolean(props.eventPlan),
);
const showEventBlock = computed(() => selectionFor("event") === "render" && showEventAct.value);
const showEventFallback = computed(() => selectionFor("event") === "fallback");
const showHelpAct = computed(
  () => isPostActionAvailable("help-act", actionContext.value) && Boolean(props.helpPlan),
);
const showHelpBlock = computed(() => selectionFor("help") === "render" && showHelpAct.value);
const showHelpFallback = computed(() => selectionFor("help") === "fallback");
const showHelpManageBlock = computed(
  () =>
    selectionFor("help") === "render" &&
    Boolean(props.helpManagePlan) &&
    Boolean(props.canManageHelp),
);
const showMerchantBlock = computed(() => selectionFor("merchant") === "render");
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
      @act="emit('helpAct')"
      @open-linked-event="emit('helpOpenLinkedEvent', $event)"
    />
    <PostDetailTypedFallbackBlock v-else-if="showHelpFallback" post-type="help" />

    <PostDetailHelpManageBlock
      v-if="showHelpManageBlock"
      :plan="helpManagePlan!"
      :busy="!!helpManageBusy"
      :action-error="helpManageActionError"
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
