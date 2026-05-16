<script setup lang="ts">
import type { PlaceSheet, PlaceStatus } from "../../types/place";
import PostDetailGallery from "./PostDetailGallery.vue";
import PostDetailMainBody from "./PostDetailMainBody.vue";
import PostDetailInfoStrip from "./PostDetailInfoStrip.vue";
import PostPlaceSheetBlock from "./PostPlaceSheetBlock.vue";
import PostReportBlock from "./PostReportBlock.vue";
import PostActionFeedback from "./PostActionFeedback.vue";

defineProps<{
  title?: string;
  bodyHtml?: string;
  images?: string[];
  primaryTag?: string;
  timeLabel?: string;
  placeLabel?: string;
  placeStatusText?: string;
  structuredPlace?: { id?: string; name?: string; type?: string; status?: PlaceStatus } | null;
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
}>();

const emit = defineEmits<{
  galleryPointerDown: [event: PointerEvent];
  galleryPointerMove: [event: PointerEvent];
  openGalleryImage: [index: number];
  openPlaceSheet: [];
  toggleReport: [];
  submitReport: [];
  hideReportedPost: [];
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
