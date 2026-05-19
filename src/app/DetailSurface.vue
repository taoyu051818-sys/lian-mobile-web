<script setup lang="ts">
// App-level detail overlay. The detail-navigation FSM is the single source
// of truth for "which tid (if any) is open"; this surface mounts the panel
// once at the App level and Teleports to <body> so it cannot collide with
// AppShell layout, ShellChrome transitions, or any single page's mount
// lifecycle. See issue #636.
import { watch } from "vue";
import { useDetailNavigation } from "./detail-navigation";
import { useFloatingChromeState } from "../shell/floatingChromeState";
import { PostDetailPanel } from "../features/detail";
import { POST_DETAIL_DIALOG_LABEL } from "../config/brand";

const detail = useDetailNavigation();
const { setDetailPhase } = useFloatingChromeState();

// Keep the legacy "hide top chrome while detail is open" behavior. Used to
// live in FeedView; lifting it here ties the floating-chrome phase to the
// FSM's open/close, not to a specific page.
watch(detail.detailOpen, (open) => setDetailPhase(open ? "open" : "idle"), { immediate: true });
</script>

<template>
  <Teleport to="body">
    <div
      v-if="detail.detailOpen.value"
      class="detail-surface"
      role="dialog"
      aria-modal="true"
      :aria-label="POST_DETAIL_DIALOG_LABEL"
    >
      <PostDetailPanel
        :post="detail.detailPost.value"
        :loading="detail.detailLoading.value"
        :error="detail.detailError.value"
        @close="detail.close('user-tap')"
        @retry="detail.retry()"
      />
    </div>
  </Teleport>
</template>

<style scoped>
.detail-surface {
  position: fixed;
  inset: 0;
  z-index: 30;
  overflow-y: auto;
  background: var(--lian-surface, #fff);
}
</style>
