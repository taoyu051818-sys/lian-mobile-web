<script setup lang="ts">
import { computed } from "vue";
import type { PostType } from "../../types/post";

type DetailActionFallbackPostType = Extract<PostType, "event" | "help" | "merchant" | "trade">;

const props = defineProps<{
  postType: DetailActionFallbackPostType;
}>();

interface FallbackConfig {
  blockLabel: string;
  title: string;
  actionLabel: string;
  reason: string;
}

const FALLBACK_CONFIG: Record<DetailActionFallbackPostType, FallbackConfig> = {
  event: {
    blockLabel: "活动操作",
    title: "活动信息暂时不可用",
    actionLabel: "暂时无法报名",
    reason: "这条内容看起来是活动帖，但详情没有返回活动时间、人数或报名信息，现在还不能判断是否可以参加。",
  },
  help: {
    blockLabel: "求助操作",
    title: "求助信息暂时不可用",
    actionLabel: "暂时无法投票",
    reason: "这条内容看起来是求助帖，但详情没有返回求助状态或投票信息，现在还不能判断是否可以支持。",
  },
  merchant: {
    blockLabel: "商家跑腿",
    title: "商家跑腿入口暂时不可用",
    actionLabel: "暂时无法帮我取",
    reason: "这条内容看起来是商家帖，但详情没有返回商家信息或跑腿资格，现在还不能判断是否可以下单。",
  },
  trade: {
    blockLabel: "交易操作",
    title: "交易信息暂时不可用",
    actionLabel: "暂时无法查看交易状态",
    reason: "这条内容看起来是交易帖，但详情没有返回价格、状态或交易说明，现在还不能判断是否还能继续联系。",
  },
};

const config = computed(() => FALLBACK_CONFIG[props.postType]);
const rootTestId = computed(() => `post-detail-${props.postType}-fallback-block`);
const actionTestId = computed(() => `post-detail-${props.postType}-fallback-action`);
const reasonTestId = computed(() => `post-detail-${props.postType}-fallback-reason`);
</script>

<template>
  <section
    class="post-detail-typed-fallback-block"
    :data-type="postType"
    :aria-label="config.blockLabel"
    :data-testid="rootTestId"
  >
    <header class="post-detail-typed-fallback-block__header">
      <span class="post-detail-typed-fallback-block__eyebrow">{{ config.blockLabel }}</span>
      <h3 class="post-detail-typed-fallback-block__title">{{ config.title }}</h3>
    </header>

    <button
      type="button"
      class="post-detail-typed-fallback-block__action"
      disabled
      aria-disabled="true"
      :data-testid="actionTestId"
    >
      {{ config.actionLabel }}
    </button>

    <p class="post-detail-typed-fallback-block__reason" :data-testid="reasonTestId">
      {{ config.reason }}
    </p>
  </section>
</template>

<style scoped>
.post-detail-typed-fallback-block {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px dashed rgba(120, 120, 120, 0.28);
  border-radius: var(--radius-card, 12px);
  background: rgba(120, 120, 120, 0.06);
}

.post-detail-typed-fallback-block__header {
  display: grid;
  gap: 4px;
}

.post-detail-typed-fallback-block__eyebrow {
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 800;
}

.post-detail-typed-fallback-block__title {
  margin: 0;
  color: var(--lian-ink);
  font-size: 16px;
  line-height: 1.4;
}

.post-detail-typed-fallback-block__action {
  justify-self: start;
  appearance: none;
  border: 0;
  border-radius: var(--radius-chip, 999px);
  background: rgba(120, 120, 120, 0.28);
  color: rgba(40, 40, 40, 0.86);
  font-weight: 800;
  height: 36px;
  padding: 0 var(--space-3);
  cursor: not-allowed;
}

.post-detail-typed-fallback-block__reason {
  margin: 0;
  color: var(--lian-muted);
  font-size: 13px;
  line-height: 1.5;
}
</style>
