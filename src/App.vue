<script setup lang="ts">
import { computed, onBeforeUnmount } from "vue";
import { BottomTabBar, ToastHost } from "./ui";
import AppViewHost from "./app/AppViewHost.vue";
import { appViews, type AppViewKey } from "./app/view-types";
import { useActiveView } from "./app/useActiveView";
import { type FloatingChromeCommand, useFloatingChromeController } from "./motion/floatingChrome";

type ChromeStatePayload = FloatingChromeCommand;

const { activeViewKey, setActiveView } = useActiveView();
const appBottomChrome = useFloatingChromeController({ initialPhase: "visible" });

const tabs = appViews.map((view) => ({
  key: view.key,
  label: view.label,
  icon: view.icon,
}));

const bottomChromeState = computed(() => appBottomChrome.phase.value);
const bottomChromeStyle = computed(() => appBottomChrome.style.value);
const chromeProgress = computed(() => appBottomChrome.progress.value);

function isAppViewKey(key: string): key is AppViewKey {
  return appViews.some((view) => view.key === key);
}

function handleChromeChange(payload: ChromeStatePayload) {
  appBottomChrome.apply(payload);
}

function handleViewChange(key: string) {
  appBottomChrome.show();
  if (isAppViewKey(key)) {
    setActiveView(key);
  }
}

onBeforeUnmount(() => {
  appBottomChrome.dispose();
});
</script>

<template>
  <main class="vue-shell" aria-label="LIAN 主内容">
    <div class="vue-shell__grid">
      <AppViewHost :active-view-key="activeViewKey" @chrome="handleChromeChange" />
      <BottomTabBar
        class="vue-shell__bottom-tab lian-floating-chrome lian-floating-chrome--bottom"
        :class="{ 'is-hidden': bottomChromeState === 'hidden' }"
        data-floating-chrome="bottom"
        :data-floating-state="bottomChromeState"
        :data-floating-progress="bottomChromeState === 'progress' ? chromeProgress : undefined"
        :style="bottomChromeStyle"
        :items="tabs"
        :active-key="activeViewKey"
        @change="handleViewChange"
      />
    </div>
  </main>
  <ToastHost />
</template>
