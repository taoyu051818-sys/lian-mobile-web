<script setup lang="ts">
// App-level detail overlay. The detail-navigation FSM is the single source
// of truth for "which tid (if any) is open"; this surface mounts the panel
// once at the App level and Teleports to <body> so it cannot collide with
// AppShell layout, ShellChrome transitions, or any single page's mount
// lifecycle. See issue #636.
import { onBeforeUnmount, watch } from "vue";
import { useDetailNavigation } from "./detail-navigation";
import { useFloatingChromeState } from "../shell/floatingChromeState";
import { PostDetailPanel } from "../features/detail";
import { POST_DETAIL_DIALOG_LABEL } from "../config/brand";

const detail = useDetailNavigation();
const { setDetailPhase } = useFloatingChromeState();

function setHostFrozen(frozen: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("detail-surface-open", frozen);
  document.body.classList.toggle("detail-surface-open", frozen);
}

// Keep the legacy "hide top chrome while detail is open" behavior. Used to
// live in FeedView; lifting it here ties the floating-chrome phase to the
// FSM's open/close, not to a specific page.
watch(
  detail.detailOpen,
  (open) => {
    setDetailPhase(open ? "open" : "idle");
    setHostFrozen(open);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  setHostFrozen(false);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="detail.detailOpen.value"
      class="detail-surface"
      role="dialog"
      aria-modal="true"
      :aria-label="POST_DETAIL_DIALOG_LABEL"
      data-testid="detail-surface"
      @click.self="detail.close('user-tap')"
    >
      <div class="detail-surface__scrim" aria-hidden="true" />
      <div class="detail-surface__sheet">
        <PostDetailPanel
          :post="detail.detailPost.value"
          :loading="detail.detailLoading.value"
          :error="detail.detailError.value"
          @close="detail.close('user-tap')"
          @retry="detail.retry()"
        />
      </div>
    </div>
    <!--
      Reply-dock teleport target. The dock used to sit in the shell's
      bottom slot, which displaced the BottomTabBar — that broke the
      cold-start contract (#636) where the underlying tab bar must stay
      mounted while the App-level detail overlay is open. Hosting the
      dock here keeps it pinned to the viewport bottom, layered above
      the chrome (z = --z-detail-sheet, 90 > --z-chrome, 70) so it sits
      over the now-resident tab bar while the panel is open.
    -->
    <div
      v-if="detail.detailOpen.value"
      id="lian-detail-surface-dock-slot"
      class="detail-surface__dock-host lian-floating-chrome lian-floating-chrome--bottom"
      data-floating-chrome="bottom"
    />
  </Teleport>
</template>

<style scoped>
:global(html.detail-surface-open),
:global(body.detail-surface-open) {
  overflow: hidden;
}

:global(body.detail-surface-open) {
  touch-action: none;
}

:global(body.detail-surface-open #vue-root) {
  height: 100vh;
  overflow: hidden;
}

.detail-surface {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  align-items: stretch;
  overflow: hidden;
  padding: env(safe-area-inset-top) 0 env(safe-area-inset-bottom);
}

/* Reply-dock host. Pinned to the bottom of the viewport (.lian-floating-chrome
   --bottom positioning is supplied by chrome-surface.css), but layered above
   the BottomTabBar (z = --z-chrome, 70) so an open detail's reply dock sits
   in front of the underlying tab bar. The tab bar itself stays mounted to
   honor the App-level overlay contract from #636. */
.detail-surface__dock-host {
  z-index: var(--z-detail-sheet);
}

.detail-surface__scrim {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(6, 10, 20, 0.18), rgba(6, 10, 20, 0.34)), rgba(10, 18, 28, 0.18);
  backdrop-filter: blur(12px) saturate(1.12);
}

.detail-surface__sheet {
  position: relative;
  z-index: 1;
  width: min(100%, 760px);
  height: 100%;
  margin: 0 auto;
  overflow-y: auto;
  overscroll-behavior: contain;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(247, 251, 255, 0.96)),
    var(--lian-surface, #fff);
  box-shadow: 0 24px 72px rgba(9, 15, 25, 0.28);
}

@media (min-width: 720px) {
  .detail-surface {
    padding: calc(env(safe-area-inset-top) + var(--space-2)) var(--space-4)
      env(safe-area-inset-bottom);
  }

  .detail-surface__sheet {
    border-radius: 28px 28px 0 0;
    border: 1px solid rgba(255, 255, 255, 0.7);
  }
}
</style>
