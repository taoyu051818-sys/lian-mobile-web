<script setup lang="ts">
import { ref, toRef, watch } from "vue";
import type { AudienceVisibility } from "../../types/audience";
import { TrustBadge, VisibilityBadge } from "../../ui";
import { useFeedCardLike } from "./useFeedCardLike";

const props = defineProps<{
  tid: number;
  authorName: string;
  authorAvatarUrl: string;
  authorInitial: string;
  timeLabel: string;
  liked?: boolean;
  likeCount?: number;
  visibility?: AudienceVisibility;
  trustSignal?: string | null;
}>();

const { liked, likeCount, likeBusy, likeLabel, handleLike } = useFeedCardLike({
  tid: toRef(props, "tid"),
  liked: toRef(props, "liked"),
  likeCount: toRef(props, "likeCount"),
});

const avatarError = ref(false);

watch(
  () => props.authorAvatarUrl,
  () => {
    avatarError.value = false;
  },
);

function handleAvatarError() {
  avatarError.value = true;
}
</script>

<template>
  <footer class="feed-item-card__footer">
    <div class="feed-item-card__author">
      <img
        v-if="authorAvatarUrl && !avatarError"
        :src="authorAvatarUrl"
        :alt="authorName"
        loading="lazy"
        draggable="false"
        @error="handleAvatarError"
      />
      <span v-else class="feed-item-card__avatar-text" aria-hidden="true">{{ authorInitial }}</span>
      <span class="feed-item-card__author-name" :title="authorName">{{ authorName }}</span>
      <TrustBadge v-if="trustSignal" tone="confirmed" class="feed-item-card__trust-signal">
        {{ trustSignal }}
      </TrustBadge>
    </div>

    <VisibilityBadge
      :visibility="visibility"
      :show-icon="true"
      class="feed-item-card__visibility"
    />

    <span class="feed-item-card__motion-time" aria-hidden="true">{{ timeLabel }}</span>

    <button
      class="feed-item-card__like"
      :class="{ 'is-liked': liked }"
      type="button"
      :aria-label="likeLabel"
      :aria-pressed="liked"
      :disabled="likeBusy"
      data-card-control="like"
      @click.stop="handleLike"
      @pointerdown.stop
      @pointerup.stop
      @keydown.enter.stop
      @keydown.space.stop
    >
      <span aria-hidden="true">{{ liked ? "♥" : "♡" }}</span>
      <span>{{ likeCount }}</span>
    </button>
  </footer>
</template>

<style scoped>
.feed-item-card__footer {
  display: flex;
  min-width: 0;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.feed-item-card__author {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  max-width: calc(100% - 50px);
  gap: var(--space-1);
  align-items: center;
  color: var(--lian-muted);
  font-size: 11px;
  line-height: 1.2;
}

.feed-item-card__author img,
.feed-item-card__avatar-text {
  display: grid;
  width: 20px;
  min-width: 20px;
  height: 20px;
  place-items: center;
  border-radius: var(--radius-orb);
  object-fit: cover;
  background: var(--lian-primary-soft);
  color: var(--lian-primary-deep);
  font-size: 10px;
  font-weight: 900;
}

.feed-item-card__author img {
  pointer-events: none;
  -webkit-user-drag: none;
}

.feed-item-card__author-name {
  overflow: hidden;
  min-width: 0;
  max-width: min(10ch, 100%);
  color: var(--lian-ink);
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feed-item-card__trust-signal {
  min-height: 20px;
  padding: 0 6px;
  font-size: 10px;
}

.feed-item-card__motion-time {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  color: var(--lian-muted);
  font-size: 11px;
  white-space: nowrap;
}

.feed-item-card__like {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 3px;
  align-items: center;
  justify-content: center;
  min-width: 42px;
  min-height: 30px;
  padding: 0 8px;
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.62);
  color: var(--lian-muted);
  font-size: 11px;
  font-weight: 900;
}

.feed-item-card__like.is-liked {
  background: rgba(255, 236, 236, 0.82);
  color: #c2410c;
}

.feed-item-card__like:disabled {
  opacity: 0.64;
}

.feed-item-card__visibility {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 3px;
  align-items: center;
  padding: 2px 6px;
  border-radius: var(--radius-chip);
  background: rgba(31, 41, 51, 0.06);
  color: var(--lian-muted);
  font-size: 10px;
  font-weight: 700;
  line-height: 1.2;
}
</style>
