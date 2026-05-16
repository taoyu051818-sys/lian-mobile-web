<script setup lang="ts">
import { POST_DETAIL_DIALOG_LABEL } from "../../config/brand";
import type { PostDetail } from "../../types/post";
import PostDetailPanel from "../detail/PostDetailPanel.vue";

defineProps<{
  post: PostDetail | null;
  loading: boolean;
  error: string;
}>();

defineEmits<{
  close: [];
  retry: [];
}>();
</script>

<template>
  <div
    class="profile-view__detail-overlay"
    role="dialog"
    aria-modal="true"
    :aria-label="POST_DETAIL_DIALOG_LABEL"
  >
    <PostDetailPanel
      :post="post"
      :loading="loading"
      :error="error"
      @close="$emit('close')"
      @retry="$emit('retry')"
    />
  </div>
</template>

<style scoped>
.profile-view__detail-overlay {
  position: fixed;
  inset: 0;
  z-index: 30;
  overflow-y: auto;
  background: var(--lian-surface, #fff);
}
</style>
