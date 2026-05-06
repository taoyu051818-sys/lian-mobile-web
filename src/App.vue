<script setup lang="ts">
import { ref } from "vue";
import { BottomTabBar, ToastHost } from "./ui";
import AppViewHost from "./app/AppViewHost.vue";
import { appViews, type AppViewKey } from "./app/view-types";
import { useActiveView } from "./app/useActiveView";

const { activeViewKey, setActiveView } = useActiveView();
const chromeHidden = ref(false);

const tabs = appViews.map((view) => ({
  key: view.key,
  label: view.label,
  icon: view.icon,
}));

function isAppViewKey(key: string): key is AppViewKey {
  return appViews.some((view) => view.key === key);
}

function handleViewChange(key: string) {
  chromeHidden.value = false;
  if (isAppViewKey(key)) {
    setActiveView(key);
  }
}
</script>

<template>
  <main class="vue-shell" aria-label="LIAN 主内容">
    <div class="vue-shell__grid">
      <AppViewHost :active-view-key="activeViewKey" @chrome="chromeHidden = $event" />
      <BottomTabBar
        class="vue-shell__bottom-tab"
        :class="{ 'is-hidden': chromeHidden }"
        :items="tabs"
        :active-key="activeViewKey"
        @change="handleViewChange"
      />
    </div>
  </main>
  <ToastHost />
</template>

<style scoped>
.vue-shell__bottom-tab {
  transition: opacity 180ms ease, transform 180ms ease;
}

.vue-shell__bottom-tab.is-hidden {
  opacity: 0;
  pointer-events: none;
  transform: translateY(18px) scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .vue-shell__bottom-tab {
    transition: none;
  }

  .vue-shell__bottom-tab.is-hidden {
    opacity: 1;
    transform: none;
  }
}
</style>
