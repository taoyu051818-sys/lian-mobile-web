<script setup lang="ts">
import { computed } from "vue";
import {
  PUBLISH_ACTIONABLE_PREVIEW_ACTION,
  PUBLISH_ACTIONABLE_PREVIEW_COMPONENTS,
  PUBLISH_ACTIONABLE_PREVIEW_KIND,
  PUBLISH_ACTIONABLE_PREVIEW_PUBLISHED,
  PUBLISH_ACTIONABLE_PREVIEW_STRUCTURED_FIELD,
  PUBLISH_ACTIONABLE_PREVIEW_WIRE_KIND,
  PUBLISH_ACTIONABLE_PREVIEW_LOCATION,
  PUBLISH_ACTIONABLE_PREVIEW_EVENT,
  PUBLISH_ACTIONABLE_PREVIEW_MERCHANT,
  PUBLISH_ACTIONABLE_PREVIEW_TITLE,
  PUBLISH_ACTIONABLE_PREVIEW_TRADE,
  PUBLISH_ACTIONABLE_PREVIEW_UNSTRUCTURED,
  PUBLISH_EVENT_JOIN_APPROVAL,
  PUBLISH_EVENT_JOIN_OPEN,
  PUBLISH_EVENT_JOIN_ORG,
  PUBLISH_EVENT_JOIN_SCHOOL,
} from "../../config/brand";
import type { PublishActionablePostPreview } from "../../types/publish";
import type { PublishKind } from "./usePublishDraft";
import type { EventJoinPolicy } from "../../types/post-extensions";
import type { InferredKind, SuggestedComponent } from "../../types/publishSuggestion";

const props = defineProps<{
  title: string;
  body: string;
  kind: PublishKind;
  suggestedComponents: SuggestedComponent[];
  locationLabel: string;
  normalizedTag: string;
  normalizedIdentityTag: string;
  eventStartsAt: string;
  eventJoinPolicy: EventJoinPolicy;
  llmInferredKind: InferredKind | null;
  uploadedImageCount: number;
  merchantName: string;
  merchantCategory: string;
  tradePrice: string;
  tradeCategory: string;
  actionablePost: PublishActionablePostPreview | null;
}>();

const kindLabel = computed(() => {
  switch (props.kind) {
    case "event":
      return "活动";
    case "merchant":
      return "商家";
    case "trade":
      return "交易";
    default:
      return "普通帖子";
  }
});

const eventJoinPolicyLabel = computed(() => {
  switch (props.eventJoinPolicy) {
    case "approval_required":
      return PUBLISH_EVENT_JOIN_APPROVAL;
    case "org_only":
      return PUBLISH_EVENT_JOIN_ORG;
    case "school_only":
      return PUBLISH_EVENT_JOIN_SCHOOL;
    default:
      return PUBLISH_EVENT_JOIN_OPEN;
  }
});

const visibleComponents = computed(() =>
  props.suggestedComponents.filter((item) => item.label.trim()),
);
const hasLocation = computed(() => props.locationLabel.trim().length > 0);
const wireKindLabel = computed(() => {
  if (props.normalizedTag.replace(/^#+/, "") === "求助") return "求助";
  if (props.uploadedImageCount > 0) return "图片";
  if (props.kind === "event") return "活动";
  if (props.kind === "merchant") return "商家";
  if (props.kind === "trade") return "交易";
  if (props.llmInferredKind === "event") return "活动";
  if (props.llmInferredKind === "merchant") return "商家";
  if (props.llmInferredKind === "trade") return "交易";
  if (props.llmInferredKind === "place" && hasLocation.value && !props.body.trim()) {
    return "地点";
  }
  if (hasLocation.value && !props.body.trim()) return "地点";
  return "文字";
});
const hasWireStructure = computed(
  () =>
    props.uploadedImageCount > 0 ||
    Boolean(
      props.llmInferredKind && props.llmInferredKind !== "text" && props.llmInferredKind !== "help",
    ),
);
const hasEvent = computed(() => props.kind === "event" && props.eventStartsAt.trim().length > 0);
const hasMerchant = computed(
  () => props.kind === "merchant" && props.merchantName.trim().length > 0,
);
const hasTrade = computed(
  () =>
    props.kind === "trade" &&
    (props.tradePrice.trim().length > 0 || props.tradeCategory.trim().length > 0),
);
const hasStructure = computed(
  () =>
    props.kind !== "regular" ||
    hasWireStructure.value ||
    hasLocation.value ||
    hasEvent.value ||
    hasMerchant.value ||
    hasTrade.value ||
    props.normalizedTag ||
    props.normalizedIdentityTag ||
    visibleComponents.value.length > 0,
);
const shouldRender = computed(
  () => props.title.trim().length > 0 || props.body.trim().length > 0 || hasStructure.value,
);
</script>

<template>
  <aside
    v-if="shouldRender"
    class="publish-actionable-preview"
    :aria-label="PUBLISH_ACTIONABLE_PREVIEW_TITLE"
    data-testid="publish-actionable-preview"
  >
    <div class="publish-actionable-preview__header">
      <span>{{ PUBLISH_ACTIONABLE_PREVIEW_TITLE }}</span>
      <strong data-testid="publish-preview-kind"
        >{{ PUBLISH_ACTIONABLE_PREVIEW_KIND }}：{{ kindLabel }}</strong
      >
    </div>

    <div class="publish-actionable-preview__body">
      <h3 v-if="title.trim()">{{ title.trim() }}</h3>
      <p v-if="body.trim()">{{ body.trim() }}</p>
      <p class="publish-actionable-preview__wire-kind" data-testid="publish-preview-wire-kind">
        {{ PUBLISH_ACTIONABLE_PREVIEW_WIRE_KIND }}：{{ wireKindLabel }}
      </p>
      <p v-if="!hasStructure" class="publish-actionable-preview__empty">
        {{ PUBLISH_ACTIONABLE_PREVIEW_UNSTRUCTURED }}
      </p>
    </div>

    <div v-if="hasStructure" class="publish-actionable-preview__sections">
      <span v-if="hasLocation" data-testid="publish-preview-location">
        {{ PUBLISH_ACTIONABLE_PREVIEW_LOCATION }}：{{ locationLabel }}
      </span>
      <span v-if="normalizedTag">{{ normalizedTag }}</span>
      <span v-if="normalizedIdentityTag">{{ normalizedIdentityTag }}</span>
      <span v-if="hasEvent" data-testid="publish-preview-event">
        {{ PUBLISH_ACTIONABLE_PREVIEW_EVENT }}：{{ eventStartsAt }} · {{ eventJoinPolicyLabel }}
      </span>
      <span v-if="hasMerchant" data-testid="publish-preview-merchant">
        {{ PUBLISH_ACTIONABLE_PREVIEW_MERCHANT }}：{{ merchantName
        }}{{ merchantCategory ? ` · ${merchantCategory}` : "" }}
      </span>
      <span v-if="hasTrade" data-testid="publish-preview-trade">
        {{ PUBLISH_ACTIONABLE_PREVIEW_TRADE }}：{{ tradePrice || tradeCategory }}
      </span>
    </div>

    <ul
      v-if="actionablePost"
      class="publish-actionable-preview__published"
      data-testid="publish-preview-published-structure"
    >
      <li>
        <strong>{{ PUBLISH_ACTIONABLE_PREVIEW_PUBLISHED }}</strong>
        <span>{{ actionablePost.kind }}</span>
      </li>
      <li data-testid="publish-preview-action">
        <strong>{{ PUBLISH_ACTIONABLE_PREVIEW_ACTION }}</strong>
        <span>{{ actionablePost.action }}</span>
      </li>
      <li
        v-for="component in actionablePost.components"
        :key="`${component.kind}::${component.label}`"
      >
        <strong>{{ PUBLISH_ACTIONABLE_PREVIEW_STRUCTURED_FIELD }}</strong>
        <span>{{ component.label || component.kind }}</span>
      </li>
      <li v-for="item in actionablePost.structure" :key="item">
        <span>{{ item }}</span>
      </li>
    </ul>

    <ul v-if="visibleComponents.length" class="publish-actionable-preview__components">
      <li
        v-for="component in visibleComponents"
        :key="`${component.kind}::${component.label}`"
        data-testid="publish-preview-component"
      >
        <strong>{{ PUBLISH_ACTIONABLE_PREVIEW_COMPONENTS }}</strong>
        <span>{{ component.label }}</span>
      </li>
    </ul>
  </aside>
</template>

<style scoped>
.publish-actionable-preview {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid rgba(31, 167, 160, 0.22);
  border-radius: var(--radius-card);
  background: linear-gradient(180deg, rgba(31, 167, 160, 0.08), rgba(255, 255, 255, 0.8));
}

.publish-actionable-preview__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  color: var(--lian-muted);
  font-size: 13px;
  font-weight: 800;
}

.publish-actionable-preview__header strong {
  color: var(--lian-primary, #1fa7a0);
}

.publish-actionable-preview__body {
  display: grid;
  gap: var(--space-2);
}

.publish-actionable-preview__body h3,
.publish-actionable-preview__body p {
  margin: 0;
}

.publish-actionable-preview__body h3 {
  color: var(--lian-ink);
  font-size: 16px;
  font-weight: 900;
}

.publish-actionable-preview__body p {
  color: var(--lian-muted);
  font-size: 14px;
  line-height: 1.55;
  white-space: pre-wrap;
}

.publish-actionable-preview__wire-kind {
  font-weight: 800;
}

.publish-actionable-preview__empty {
  color: var(--lian-muted);
  font-size: 13px;
}

.publish-actionable-preview__sections,
.publish-actionable-preview__published,
.publish-actionable-preview__components {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.publish-actionable-preview__sections span,
.publish-actionable-preview__published li,
.publish-actionable-preview__components li {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 30px;
  padding: 4px var(--space-3);
  border-radius: var(--radius-chip, 999px);
  background: rgba(255, 255, 255, 0.82);
  color: var(--lian-ink);
  font-size: 13px;
  font-weight: 800;
}

.publish-actionable-preview__published li {
  border: 1px solid rgba(31, 167, 160, 0.18);
}

.publish-actionable-preview__components li {
  border: 1px dashed rgba(31, 167, 160, 0.28);
}

.publish-actionable-preview__components strong {
  color: var(--lian-primary, #1fa7a0);
}
</style>
