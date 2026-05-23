<script setup lang="ts">
import { REPLY_DOCK_PLACEHOLDER, REPLY_DOCK_SEND, REPLY_DOCK_REPLY } from "../../config/brand";

defineProps<{
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
    class="post-reply-dock"
    :class="{ 'is-expanded': replyExpanded }"
    @submit.prevent="emit('submitReply')"
    @click.stop
  >
    <button
      v-if="!replyExpanded"
      class="post-reply-dock__action"
      :class="{ 'is-active': liked }"
      type="button"
      :disabled="likeBusy"
      :aria-busy="likeBusy ? 'true' : 'false'"
      :aria-pressed="Boolean(liked)"
      @click="emit('like')"
    >
      <span class="post-reply-dock__action-icon">{{ liked ? "♥" : "♡" }}</span>
      <span class="post-reply-dock__action-label">{{
        likeBusy ? "处理中…" : liked ? "已喜欢" : "喜欢"
      }}</span>
      <span class="post-reply-dock__action-count">{{ likeCount }}</span>
    </button>
    <button
      v-if="!replyExpanded"
      class="post-reply-dock__action"
      :class="{ 'is-active': saved }"
      type="button"
      :disabled="saveBusy"
      :aria-busy="saveBusy ? 'true' : 'false'"
      :aria-pressed="Boolean(saved)"
      @click="emit('save')"
    >
      <span class="post-reply-dock__action-icon">{{ saved ? "★" : "☆" }}</span>
      <span class="post-reply-dock__action-label">{{
        saveBusy ? "处理中…" : saved ? "已收藏" : "收藏"
      }}</span>
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
  /* Visual base (glass, shadow, fixed inset, width) is provided by the
     parent shell-chrome bottom region (see ShellChrome.vue). The dock
     itself only owns its internal layout. */
  display: flex;
  gap: var(--space-2);
  align-items: center;
  width: 100%;
  min-height: var(--floating-bar-height);
  padding: var(--floating-bar-padding);
  transition:
    min-height 180ms ease,
    align-items 180ms ease;
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

.post-reply-dock__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 82px;
}

.post-reply-dock__action.is-active {
  background: rgba(255, 236, 236, 0.82);
  color: #c2410c;
}

.post-reply-dock__action-count {
  min-width: 1.5em;
  text-align: right;
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
