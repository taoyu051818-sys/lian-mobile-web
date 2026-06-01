<script setup lang="ts">
import { computed, ref } from "vue";
import { SafeHtml, TrustBadge } from "../../ui";
import {
  EMPTY_REPLIES,
  REPLY_SECTION_TITLE,
  REPLY_COUNT_LABEL,
  REPLY_EMPTY_PROMPT,
  REPLY_SORT_LABEL,
  REPLY_SORT_NEWEST,
  REPLY_SORT_OLDEST,
  TRUST_SIGNAL_UNKNOWN,
} from "../../config/brand";
import { actorDisplayName } from "../../domain/actor";
import type { PostReply } from "../../types/post";
import { formatRelativeTime } from "../../utils/time";

type ReplySortOrder = "newest" | "oldest";

interface SortChip {
  value: ReplySortOrder;
  label: string;
}

const sortChips: readonly SortChip[] = [
  { value: "newest", label: REPLY_SORT_NEWEST },
  { value: "oldest", label: REPLY_SORT_OLDEST },
];

const props = defineProps<{
  replies?: PostReply[];
}>();

const sortOrder = ref<ReplySortOrder>("newest");

const sortedReplies = computed(() => {
  if (!props.replies?.length) return [];
  const sorted = [...props.replies];
  if (sortOrder.value === "newest") {
    // Descending by timestamp (newest first)
    sorted.sort((a, b) => new Date(b.timestampISO).getTime() - new Date(a.timestampISO).getTime());
  } else {
    // Ascending by timestamp (oldest first)
    sorted.sort((a, b) => new Date(a.timestampISO).getTime() - new Date(b.timestampISO).getTime());
  }
  return sorted;
});

function selectSort(value: ReplySortOrder) {
  sortOrder.value = value;
}

function sanitizeReplyHtml(value: string) {
  return String(value || "")
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<p[^>]*>\s*<strong>\s*#+[^<]+\s*<\/strong>\s*<\/p>/gi, "")
    .replace(/<p[^>]*>\s*#+[^<]+\s*<\/p>/gi, "")
    .trim();
}

function replyTrustSignal(reply: PostReply) {
  if (reply.source?.visible === false) return null;
  return (
    reply.source?.label || reply.actor?.identityTag || (reply.source ? TRUST_SIGNAL_UNKNOWN : null)
  );
}
</script>

<template>
  <section class="post-replies" aria-labelledby="post-detail-replies-title">
    <div class="post-replies__section-title">
      <h3 id="post-detail-replies-title">{{ REPLY_SECTION_TITLE }}</h3>
      <span>{{ replies?.length ? `${replies.length} ${REPLY_COUNT_LABEL}` : EMPTY_REPLIES }}</span>
    </div>

    <div
      v-if="replies?.length"
      class="post-replies__sort-bar"
      role="radiogroup"
      :aria-label="REPLY_SORT_LABEL"
      data-testid="reply-sort-bar"
    >
      <button
        v-for="chip in sortChips"
        :key="chip.value"
        type="button"
        role="radio"
        class="post-replies__sort-chip"
        :class="{ 'is-active': sortOrder === chip.value }"
        :aria-checked="sortOrder === chip.value"
        :data-sort-value="chip.value"
        data-testid="reply-sort-chip"
        @click="selectSort(chip.value)"
      >
        {{ chip.label }}
      </button>
    </div>

    <!--
      Performance: v-memo skips re-rendering reply items when their key
      properties haven't changed. Replies are immutable once loaded, so we
      only need to re-render when the reply content or timestamp changes.
    -->
    <article
      v-for="reply in sortedReplies"
      :key="String(reply.id)"
      v-memo="[reply.id, reply.content, reply.timestampISO]"
      class="post-replies__item"
    >
      <div class="post-replies__meta">
        <div class="post-replies__actor">
          <strong v-if="actorDisplayName(reply.actor)">{{ actorDisplayName(reply.actor) }}</strong>
          <TrustBadge
            v-if="replyTrustSignal(reply)"
            tone="confirmed"
            class="post-replies__trust-signal"
          >
            {{ replyTrustSignal(reply) }}
          </TrustBadge>
        </div>
        <span v-if="formatRelativeTime(reply.timestampISO)">{{
          formatRelativeTime(reply.timestampISO)
        }}</span>
      </div>
      <SafeHtml
        :html="sanitizeReplyHtml(reply.content || '')"
        as="div"
        class="post-replies__content"
      />
    </article>
    <p v-if="!replies?.length" class="post-replies__empty">{{ REPLY_EMPTY_PROMPT }}</p>
  </section>
</template>

<style scoped>
.post-replies {
  display: grid;
  gap: var(--space-3);
}

.post-replies__section-title {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.post-replies__section-title h3 {
  margin: 0;
}

.post-replies__section-title span {
  color: var(--lian-muted);
  font-size: 12px;
}

.post-replies__sort-bar {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.post-replies__sort-chip {
  flex: 0 0 auto;
  min-height: 28px;
  padding: 0 var(--space-2);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 850;
  cursor: pointer;
  transition:
    background-color var(--motion-fast) var(--motion-ease-standard),
    color var(--motion-fast) var(--motion-ease-standard),
    border-color var(--motion-fast) var(--motion-ease-standard);
}

.post-replies__sort-chip:hover,
.post-replies__sort-chip:focus-visible {
  color: var(--lian-ink);
  border-color: var(--lian-primary);
}

.post-replies__sort-chip.is-active {
  background: var(--lian-primary, #1fa7a0);
  border-color: var(--lian-primary, #1fa7a0);
  color: #fff;
}

.post-replies__sort-chip:focus-visible {
  outline: 2px solid var(--lian-primary);
  outline-offset: 2px;
}

.post-replies__item {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.46);
}

.post-replies__meta {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.post-replies__actor {
  display: inline-flex;
  min-width: 0;
  gap: var(--space-1);
  align-items: center;
}

.post-replies__trust-signal {
  min-height: 20px;
  padding: 0 6px;
  font-size: 10px;
}

.post-replies__meta span {
  color: var(--lian-muted);
  font-size: 12px;
}

.post-replies__content {
  color: var(--lian-muted);
  line-height: 1.62;
}

.post-replies__empty {
  color: var(--lian-muted);
  text-align: center;
}
</style>
