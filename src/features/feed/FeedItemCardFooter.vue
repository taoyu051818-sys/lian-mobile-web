<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { togglePostLike } from "../../api/posts";
import { FEED_LIKE, FEED_UNLIKE, FEED_VISIBILITY_LABELS } from "../../config/brand";
import type { AudienceVisibility } from "../../types/audience";
import { LianIcon } from "../../ui";

const props = defineProps<{
  tid: number;
  authorName: string;
  authorAvatarUrl: string;
  authorInitial: string;
  timeLabel: string;
  liked?: boolean;
  likeCount?: number;
  visibility?: AudienceVisibility;
}>();

const emit = defineEmits<{
  liked: [liked: boolean, count: number];
}>();

// eslint-disable-next-line vue/no-dupe-keys -- intentional optimistic update: props synced to local refs
const liked = ref(false);
// eslint-disable-next-line vue/no-dupe-keys -- intentional optimistic update: props synced to local refs
const likeCount = ref(0);
const likeBusy = ref(false);

const likeLabel = computed(
  () => `${liked.value ? FEED_UNLIKE : FEED_LIKE}，当前 ${likeCount.value} 个喜欢`,
);

// Visibility label — only show for non-public posts
const visibilityLabel = computed(() => {
  const v = props.visibility || "public";
  return v !== "public" ? FEED_VISIBILITY_LABELS[v] || null : null;
});

const visibilityIcon = computed(() => {
  const v = props.visibility || "public";
  const iconMap: Record<string, "building" | "graduation-cap" | "lock" | "link"> = {
    campus: "building",
    school: "graduation-cap",
    private: "lock",
    linkOnly: "link",
  };
  return iconMap[v] || null;
});

watch(
  () => [props.liked, props.likeCount],
  () => {
    liked.value = Boolean(props.liked);
    likeCount.value = Math.max(0, Number(props.likeCount || 0));
  },
  { immediate: true },
);

async function handleLike() {
  if (likeBusy.value) return;
  const previousLiked = liked.value;
  const previousCount = likeCount.value;
  const nextLiked = !previousLiked;
  liked.value = nextLiked;
  likeCount.value = Math.max(0, previousCount + (nextLiked ? 1 : -1));
  likeBusy.value = true;
  try {
    const response = await togglePostLike(props.tid, nextLiked);
    liked.value = Boolean(response.liked);
    likeCount.value = Math.max(0, Number(response.likeCount || 0));
  } catch {
    liked.value = previousLiked;
    likeCount.value = previousCount;
  } finally {
    likeBusy.value = false;
  }
  emit("liked", liked.value, likeCount.value);
}
</script>

<template>
  <footer class="feed-item-card__footer">
    <div class="feed-item-card__author">
      <img
        v-if="authorAvatarUrl"
        :src="authorAvatarUrl"
        :alt="authorName"
        loading="lazy"
        draggable="false"
      />
      <span v-else class="feed-item-card__avatar-text" aria-hidden="true">{{ authorInitial }}</span>
      <span class="feed-item-card__author-name" :title="authorName">{{ authorName }}</span>
    </div>

    <span v-if="visibilityLabel && visibilityIcon" class="feed-item-card__visibility">
      <LianIcon :name="visibilityIcon" :size="12" />
      <span>{{ visibilityLabel }}</span>
    </span>

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
