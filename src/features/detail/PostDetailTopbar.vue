<script setup lang="ts">
import {
  POST_DETAIL_CLOSE,
  POST_DETAIL_AUTHOR_AVATAR,
  POST_DETAIL_SHARE,
} from "../../config/brand";

defineProps<{
  authorLabel?: string;
  avatarUrl?: string;
  authorInitial?: string;
  hasAuthorIdentity?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  share: [];
}>();
</script>

<template>
  <header class="post-detail-topbar">
    <button
      class="post-detail-topbar__close"
      type="button"
      :aria-label="POST_DETAIL_CLOSE"
      @click="emit('close')"
    >
      ‹
    </button>
    <div v-if="hasAuthorIdentity" class="post-detail-topbar__author-chip">
      <img
        v-if="avatarUrl"
        :src="avatarUrl"
        :alt="authorLabel || POST_DETAIL_AUTHOR_AVATAR"
        loading="lazy"
      />
      <span v-else-if="authorInitial" class="post-detail-topbar__avatar-text" aria-hidden="true">{{
        authorInitial
      }}</span>
      <strong v-if="authorLabel">{{ authorLabel }}</strong>
    </div>
    <div
      v-else
      class="post-detail-topbar__author-chip post-detail-topbar__author-chip--empty"
      aria-hidden="true"
    ></div>
    <button
      class="post-detail-topbar__share"
      type="button"
      :aria-label="POST_DETAIL_SHARE"
      @click="emit('share')"
    >
      {{ POST_DETAIL_SHARE }}
    </button>
  </header>
</template>

<style scoped>
.post-detail-topbar {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 64px;
  gap: var(--space-1);
  align-items: center;
  width: 100%;
  min-height: var(--floating-bar-height);
  padding: var(--floating-bar-padding);
}

.post-detail-topbar__close,
.post-detail-topbar__share {
  border: 0;
  background: transparent;
  color: var(--lian-ink);
  font: inherit;
  display: grid;
  height: var(--floating-bar-button-height);
  place-items: center;
  border-radius: var(--radius-chip);
  font-weight: 900;
}

.post-detail-topbar__close {
  width: var(--floating-bar-button-height);
  font-size: 24px;
}

.post-detail-topbar__share {
  min-width: 56px;
  padding: 0 var(--space-3);
  background: var(--lian-ink);
  color: #fff;
  font-size: 13px;
}

.post-detail-topbar__author-chip {
  display: flex;
  min-width: 0;
  gap: var(--space-2);
  align-items: center;
  justify-self: start;
}

.post-detail-topbar__author-chip img,
.post-detail-topbar__avatar-text {
  display: grid;
  width: 32px;
  min-width: 32px;
  height: 32px;
  place-items: center;
  border-radius: var(--radius-orb);
  object-fit: cover;
  background: var(--lian-primary-soft);
  color: var(--lian-primary-deep);
  font-size: 13px;
  font-weight: 900;
}

.post-detail-topbar__author-chip strong {
  overflow: hidden;
  max-width: 38vw;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .post-detail-topbar {
    transition: none;
  }
}
</style>
