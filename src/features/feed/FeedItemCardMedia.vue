<script setup lang="ts">
defineProps<{
  coverUrl?: string;
  title?: string;
  primaryTag?: string;
  cardTemplate?: string;
  templateMark?: string;
}>();
</script>

<template>
  <div v-if="cardTemplate !== 'text' || coverUrl" class="feed-item-card__media">
    <img
      v-if="coverUrl"
      class="feed-item-card__cover"
      :src="coverUrl"
      :alt="title"
      loading="lazy"
      draggable="false"
    />
    <div v-else class="feed-item-card__placeholder" aria-hidden="true">
      <span>{{ templateMark }}</span>
    </div>
    <span v-if="primaryTag" class="feed-item-card__floating-tag">{{ primaryTag }}</span>
  </div>
</template>

<style scoped>
.feed-item-card__media {
  position: relative;
  overflow: hidden;
}

.feed-item-card__cover,
.feed-item-card__placeholder {
  width: 100%;
  background: rgba(31, 41, 51, 0.06);
}

.feed-item-card__cover {
  display: block;
  aspect-ratio: 0.76;
  object-fit: cover;
  pointer-events: none;
  -webkit-user-drag: none;
}

.feed-item-card--activity .feed-item-card__cover,
.feed-item-card--merchant .feed-item-card__cover,
.feed-item-card--place .feed-item-card__cover {
  aspect-ratio: 0.92;
}

.feed-item-card__placeholder {
  display: grid;
  min-height: 116px;
  place-items: center;
  color: var(--lian-primary-deep);
}

.feed-item-card__placeholder span {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: var(--radius-orb);
  background: rgba(255, 255, 255, 0.72);
  font-size: 18px;
  font-weight: 900;
}

.feed-item-card__floating-tag,
.feed-item-card__inline-tag {
  max-width: 100%;
  overflow: hidden;
  padding: 5px 8px;
  border-radius: var(--radius-chip);
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feed-item-card__floating-tag {
  position: absolute;
  top: var(--space-2);
  left: var(--space-2);
  max-width: calc(100% - var(--space-4));
  border: 1px solid rgba(255, 255, 255, 0.54);
  background: rgba(17, 24, 39, 0.64);
  color: #fff;
  backdrop-filter: blur(8px);
}

.feed-item-card__inline-tag {
  justify-self: start;
  border: 1px solid rgba(31, 41, 51, 0.08);
  background: rgba(255, 255, 255, 0.62);
  color: var(--lian-primary-deep);
}
</style>
