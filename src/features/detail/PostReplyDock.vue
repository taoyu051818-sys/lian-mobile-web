<script setup lang="ts">
import { REPLY_DOCK_PLACEHOLDER, REPLY_DOCK_SEND, REPLY_DOCK_REPLY } from "../../config/brand";

const props = defineProps<{
  liked?: boolean;
  saved?: boolean;
  likeCount?: number;
  likeBusy?: boolean;
  saveBusy?: boolean;
  replyBusy?: boolean;
  replyExpanded?: boolean;
  replyContent?: string;
  replyIdentityLabel?: string;
}>();

const emit = defineEmits<{
  like: [];
  save: [];
  submitReply: [];
  "update:replyExpanded": [value: boolean];
  "update:replyContent": [value: string];
}>();
</script>

<template>
  <form
    class="post-reply-dock lian-floating-chrome lian-floating-chrome--bottom"
    :class="{ 'is-expanded': replyExpanded }"
    data-floating-chrome="bottom"
    @submit.prevent="emit('submitReply')"
    @click.stop
  >
    <button
      v-if="!replyExpanded"
      class="post-reply-dock__action"
      :class="{ 'is-active': liked }"
      type="button"
      :disabled="likeBusy"
      @click="emit('like')"
    >
      {{ liked ? "♥" : "♡" }} {{ likeCount }}
    </button>
    <button
      v-if="!replyExpanded"
      class="post-reply-dock__action"
      :class="{ 'is-active': saved }"
      type="button"
      :disabled="saveBusy"
      @click="emit('save')"
    >
      {{ saved ? "★" : "☆" }}
    </button>
    <div class="post-reply-dock__reply-box" @click="emit('update:replyExpanded', true)">
      <span v-if="!replyExpanded" class="post-reply-dock__reply-placeholder">{{
        REPLY_DOCK_PLACEHOLDER
      }}</span>
      <textarea
        v-else
        :value="replyContent"
        rows="3"
        maxlength="2000"
        :placeholder="replyIdentityLabel"
        autofocus
        @input="emit('update:replyContent', ($event.target as HTMLTextAreaElement).value)"
      />
    </div>
    <button
      class="post-reply-dock__send"
      type="submit"
      :disabled="replyBusy || (replyExpanded && !replyContent?.trim())"
    >
      {{ replyExpanded ? REPLY_DOCK_SEND : REPLY_DOCK_REPLY }}
    </button>
  </form>
</template>

<style scoped>
.post-reply-dock {
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
  transition:
    transform var(--floating-chrome-motion-duration, 260ms) var(--motion-ease-standard),
    opacity var(--floating-chrome-motion-duration, 260ms) var(--motion-ease-standard),
    filter var(--floating-chrome-motion-duration, 260ms) var(--motion-ease-standard),
    bottom 200ms ease,
    min-height 180ms ease,
    align-items 180ms ease;
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  bottom: calc(var(--floating-bar-bottom-offset) + var(--keyboard-inset-bottom, 0px));
  display: flex;
  gap: var(--space-2);
  align-items: center;
  min-height: var(--floating-bar-height);
  padding: var(--floating-bar-padding);
  opacity: var(--detail-bottom-chrome-opacity, 1);
  transform: translateY(var(--detail-bottom-chrome-translate-y, 0px));
}

.post-reply-dock.is-expanded {
  align-items: flex-end;
  min-height: 132px;
}

.post-reply-dock__action,
.post-reply-dock__send {
  border: 0;
  background: transparent;
  color: var(--lian-ink);
  font: inherit;
  flex: 0 0 auto;
  min-width: 42px;
  min-height: 38px;
  padding: 0 var(--space-2);
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.62);
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 900;
}

.post-reply-dock__action.is-active {
  background: rgba(255, 236, 236, 0.82);
  color: #c2410c;
}

.post-reply-dock__reply-box {
  display: grid;
  flex: 1 1 auto;
  min-width: 0;
}

.post-reply-dock.is-expanded .post-reply-dock__reply-box {
  width: 100%;
}

.post-reply-dock__reply-placeholder {
  display: flex;
  min-height: 38px;
  align-items: center;
  padding: 0 var(--space-3);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-chip);
  background: rgba(31, 41, 51, 0.04);
  color: var(--lian-muted);
  font-size: 13px;
}

.post-reply-dock__reply-box textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--lian-border);
  border-radius: var(--radius-3);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-ink);
  font: inherit;
  min-height: 92px;
  resize: none;
  padding: var(--space-3);
  line-height: 1.5;
}

@media (prefers-reduced-motion: reduce) {
  .post-reply-dock {
    transition: none;
  }
}
</style>
