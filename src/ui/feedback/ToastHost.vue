<script setup lang="ts">
import Toast from "../Toast.vue";
import { useToast } from "./useToast";

const toast = useToast();
</script>

<template>
  <Teleport to="body">
    <div class="toast-host" aria-live="polite" aria-relevant="additions removals">
      <TransitionGroup name="lian-toast" appear>
        <Toast
          v-for="item in toast.items"
          :key="item.id"
          class="toast-host__item"
          :tone="item.tone"
        >
          <span>{{ item.message }}</span>
          <button type="button" aria-label="关闭提示" @click="toast.remove(item.id)">×</button>
        </Toast>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style>
/*
 * Apple Music gap PR-α: toast enter uses --motion-ease-overshoot for a small
 * spring on landing; leave uses --motion-ease-decelerate so it eases out
 * gently. The translate distance is small (8px) so the overshoot reads as
 * weight, not bounce. prefers-reduced-motion strips both.
 */
.lian-toast-enter-active {
  transition:
    transform var(--motion-standard) var(--motion-ease-overshoot),
    opacity var(--motion-fast) var(--motion-ease-standard);
}

.lian-toast-leave-active {
  transition:
    transform var(--motion-fast) var(--motion-ease-decelerate),
    opacity var(--motion-fast) var(--motion-ease-decelerate);
}

.lian-toast-enter-from,
.lian-toast-leave-to {
  transform: translateY(-8px);
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .lian-toast-enter-active,
  .lian-toast-leave-active {
    transition: none;
  }
}
</style>
