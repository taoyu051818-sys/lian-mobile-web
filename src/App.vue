<script setup lang="ts">
import { ref } from "vue";
import { BottomTabBar, ToastHost } from "./ui";
import AppViewHost from "./app/AppViewHost.vue";
import { appViews } from "./app/view-types";
import { useActiveView } from "./app/useActiveView";

const { activeViewKey, setActiveView } = useActiveView();
const chromeHidden = ref(false);

const tabs = appViews.map((view) => ({
  key: view.key,
  label: view.label,
  icon: view.icon,
}));

function handleViewChange(key: string) {
  chromeHidden.value = false;
  setActiveView(key);
}
</script>

<template>
  <main class="vue-shell" aria-label="LIAN 主内容">
    <div class="vue-shell__grid">
      <AppViewHost :active-view-key="activeViewKey" @chrome="chromeHidden = $event" />
      <Transition name="bottom-tab-bar-motion">
        <BottomTabBar
          v-if="!chromeHidden"
          :items="tabs"
          :active-key="activeViewKey"
          @change="handleViewChange"
        />
      </Transition>
    </div>
  </main>
  <ToastHost />
</template>

<style scoped>
.bottom-tab-bar-motion-enter-active,
.bottom-tab-bar-motion-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.bottom-tab-bar-motion-enter-from,
.bottom-tab-bar-motion-leave-to {
  opacity: 0;
  transform: translateY(18px) scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .bottom-tab-bar-motion-enter-active,
  .bottom-tab-bar-motion-leave-active {
    transition: none;
  }

  .bottom-tab-bar-motion-enter-from,
  .bottom-tab-bar-motion-leave-to {
    opacity: 1;
    transform: none;
  }
}
</style>
