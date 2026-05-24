<script setup lang="ts">
/**
 * FeedSkeleton — loading placeholder for the feed masonry grid.
 *
 * Renders 4 skeleton cards (2 per column) with a subtle shimmer animation
 * to indicate content is loading. The skeleton mimics the FeedItemCard
 * structure: cover area + body area with title and footer placeholders.
 */
</script>

<template>
  <div class="feed-skeleton" role="status" aria-label="正在加载内容">
    <div class="feed-skeleton__masonry">
      <div class="feed-skeleton__column">
        <div class="feed-skeleton__card feed-skeleton__card--tall">
          <div class="feed-skeleton__cover"></div>
          <div class="feed-skeleton__body">
            <div class="feed-skeleton__title"></div>
            <div class="feed-skeleton__footer">
              <div class="feed-skeleton__avatar"></div>
              <div class="feed-skeleton__name"></div>
            </div>
          </div>
        </div>
        <div class="feed-skeleton__card feed-skeleton__card--short">
          <div class="feed-skeleton__body feed-skeleton__body--text">
            <div class="feed-skeleton__tag"></div>
            <div class="feed-skeleton__title"></div>
            <div class="feed-skeleton__title feed-skeleton__title--short"></div>
            <div class="feed-skeleton__footer">
              <div class="feed-skeleton__avatar"></div>
              <div class="feed-skeleton__name"></div>
            </div>
          </div>
        </div>
      </div>
      <div class="feed-skeleton__column">
        <div class="feed-skeleton__card feed-skeleton__card--medium">
          <div class="feed-skeleton__cover feed-skeleton__cover--short"></div>
          <div class="feed-skeleton__body">
            <div class="feed-skeleton__title"></div>
            <div class="feed-skeleton__footer">
              <div class="feed-skeleton__avatar"></div>
              <div class="feed-skeleton__name"></div>
            </div>
          </div>
        </div>
        <div class="feed-skeleton__card feed-skeleton__card--tall">
          <div class="feed-skeleton__cover"></div>
          <div class="feed-skeleton__body">
            <div class="feed-skeleton__title"></div>
            <div class="feed-skeleton__title feed-skeleton__title--short"></div>
            <div class="feed-skeleton__footer">
              <div class="feed-skeleton__avatar"></div>
              <div class="feed-skeleton__name"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.feed-skeleton__masonry {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
  align-items: start;
}

.feed-skeleton__column {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
}

.feed-skeleton__card {
  overflow: hidden;
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: var(--lian-card-strong);
}

.feed-skeleton__cover {
  aspect-ratio: 0.76;
  background: linear-gradient(
    90deg,
    rgba(31, 41, 51, 0.06) 0%,
    rgba(31, 41, 51, 0.1) 50%,
    rgba(31, 41, 51, 0.06) 100%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

.feed-skeleton__cover--short {
  aspect-ratio: 0.92;
}

.feed-skeleton__body {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
}

.feed-skeleton__body--text {
  padding-top: var(--space-4);
}

.feed-skeleton__tag {
  width: 48px;
  height: 21px;
  border-radius: var(--radius-chip);
  background: linear-gradient(
    90deg,
    rgba(31, 41, 51, 0.06) 0%,
    rgba(31, 41, 51, 0.1) 50%,
    rgba(31, 41, 51, 0.06) 100%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

.feed-skeleton__title {
  width: 100%;
  height: 18px;
  border-radius: 4px;
  background: linear-gradient(
    90deg,
    rgba(31, 41, 51, 0.08) 0%,
    rgba(31, 41, 51, 0.12) 50%,
    rgba(31, 41, 51, 0.08) 100%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

.feed-skeleton__title--short {
  width: 60%;
}

.feed-skeleton__footer {
  display: flex;
  gap: var(--space-1);
  align-items: center;
  margin-top: var(--space-1);
}

.feed-skeleton__avatar {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-orb);
  background: linear-gradient(
    90deg,
    rgba(31, 41, 51, 0.06) 0%,
    rgba(31, 41, 51, 0.1) 50%,
    rgba(31, 41, 51, 0.06) 100%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

.feed-skeleton__name {
  width: 48px;
  height: 12px;
  border-radius: 3px;
  background: linear-gradient(
    90deg,
    rgba(31, 41, 51, 0.06) 0%,
    rgba(31, 41, 51, 0.1) 50%,
    rgba(31, 41, 51, 0.06) 100%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

@keyframes skeleton-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .feed-skeleton__cover,
  .feed-skeleton__tag,
  .feed-skeleton__title,
  .feed-skeleton__avatar,
  .feed-skeleton__name {
    animation: none;
    background: rgba(31, 41, 51, 0.08);
  }
}
</style>
