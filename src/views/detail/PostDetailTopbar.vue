<script setup lang="ts">
type FloatingChromePhase = "visible" | "exiting" | "hidden" | "entering" | "progress";

defineProps<{
  authorLabel?: string;
  authorAvatarUrl?: string;
  authorInitial?: string;
  hasAuthorIdentity?: boolean;
  chromePhase?: FloatingChromePhase;
  chromeStyle?: Record<string, string>;
}>();

const emit = defineEmits<{
  close: [];
  share: [];
}>();
</script>

<template>
  <header
    class="post-detail-topbar lian-floating-chrome lian-floating-chrome--top"
    data-floating-chrome="top"
    :data-floating-state="chromePhase"
    :style="chromeStyle"
  >
    <button class="post-detail-topbar__close" type="button" aria-label="关闭详情" @click="emit('close')">‹</button>
    <div v-if="hasAuthorIdentity" class="post-detail-topbar__author-chip">
      <img v-if="authorAvatarUrl" :src="authorAvatarUrl" :alt="authorLabel || '作者头像'" loading="lazy" />
      <span v-else-if="authorInitial" class="post-detail-topbar__avatar-text" aria-hidden="true">{{ authorInitial }}</span>
      <strong v-if="authorLabel">{{ authorLabel }}</strong>
    </div>
    <div v-else class="post-detail-topbar__author-chip post-detail-topbar__author-chip--empty" aria-hidden="true"></div>
    <button class="post-detail-topbar__share" type="button" aria-label="分享" @click="emit('share')">分享</button>
  </header>
</template>

<style scoped>
.post-detail-topbar {
  position: fixed;
  right: max(var(--floating-bar-side-inset), env(safe-area-inset-right));
  left: max(var(--floating-bar-side-inset), env(safe-area-inset-left));
  z-index: var(--floating-bar-z);
  width: min(calc(100vw - var(--space-6)), var(--floating-bar-max-width));
  margin: 0 auto;
  border: 1px solid var(--glass-border);
  border-radius: var(--floating-bar-radius);
  background: var(--glass-bg-strong);
  box-shadow: var(--shadow-floating);
  transition: transform var(--floating-chrome-motion-duration, 260ms) var(--motion-ease-standard),
    opacity var(--floating-chrome-motion-duration, 260ms) var(--motion-ease-standard),
    filter var(--floating-chrome-motion-duration, 260ms) var(--motion-ease-standard),
    min-height 180ms ease,
    align-items 180ms ease;
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  top: var(--floating-bar-top-offset);
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 64px;
  gap: var(--space-1);
  align-items: center;
  min-height: var(--floating-bar-height);
  padding: var(--floating-bar-padding);
  opacity: var(--detail-top-chrome-opacity, 1);
  transform: translateY(var(--detail-top-chrome-translate-y, 0px));
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
