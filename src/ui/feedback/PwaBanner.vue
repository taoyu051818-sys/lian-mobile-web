<script setup lang="ts">
import { usePwaUpdate } from "../../composables/usePwaUpdate";
import { useNetworkStatus } from "../../composables/useNetworkStatus";

const { updateAvailable, applyUpdate, dismissUpdate } = usePwaUpdate();
const { isOnline } = useNetworkStatus();
</script>

<template>
  <!-- Offline indicator banner -->
  <Transition name="pwa-banner">
    <div v-if="!isOnline" class="pwa-banner pwa-banner--offline" role="alert">
      <span class="pwa-banner__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path
            d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"
          />
        </svg>
      </span>
      <span class="pwa-banner__text">当前处于离线状态</span>
    </div>
  </Transition>

  <!-- PWA update available banner -->
  <Transition name="pwa-banner">
    <div v-if="updateAvailable && isOnline" class="pwa-banner pwa-banner--update" role="alert">
      <span class="pwa-banner__text">有新版本可用</span>
      <div class="pwa-banner__actions">
        <button
          type="button"
          class="pwa-banner__btn pwa-banner__btn--dismiss"
          @click="dismissUpdate"
        >
          稍后
        </button>
        <button type="button" class="pwa-banner__btn pwa-banner__btn--apply" @click="applyUpdate">
          立即更新
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.pwa-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 500;
  /* Safe area for notched devices */
  padding-top: calc(12px + env(safe-area-inset-top, 0px));
}

.pwa-banner--offline {
  background: #fef3cd;
  color: #856404;
  border-bottom: 1px solid #ffc107;
}

.pwa-banner--update {
  background: #d4edda;
  color: #155724;
  border-bottom: 1px solid #28a745;
}

.pwa-banner__icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
}

.pwa-banner__icon svg {
  width: 100%;
  height: 100%;
}

.pwa-banner__text {
  flex: 1;
  text-align: center;
}

.pwa-banner__actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.pwa-banner__btn {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}

.pwa-banner__btn--dismiss {
  background: transparent;
  color: inherit;
}

.pwa-banner__btn--dismiss:hover {
  background: rgba(0, 0, 0, 0.08);
}

.pwa-banner__btn--apply {
  background: #155724;
  color: white;
}

.pwa-banner__btn--apply:hover {
  background: #0d3d17;
}

/* Transition animations */
.pwa-banner-enter-active,
.pwa-banner-leave-active {
  transition:
    transform var(--motion-standard, 200ms) var(--motion-ease-standard, ease),
    opacity var(--motion-fast, 150ms) var(--motion-ease-standard, ease);
}

.pwa-banner-enter-from,
.pwa-banner-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .pwa-banner-enter-active,
  .pwa-banner-leave-active {
    transition: none;
  }
}
</style>
