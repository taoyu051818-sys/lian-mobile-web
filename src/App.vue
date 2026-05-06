<script setup lang="ts">
import { computed, ref } from "vue";
import { BottomTabBar, ToastHost } from "./ui";
import AppViewHost from "./app/AppViewHost.vue";
import { appViews, type AppViewKey } from "./app/view-types";
import { useActiveView } from "./app/useActiveView";

type ChromeStatePayload = boolean | {
  hidden?: boolean;
  progress?: number;
};

const { activeViewKey, setActiveView } = useActiveView();
const chromeHidden = ref(false);
const chromeProgress = ref(1);

const tabs = appViews.map((view) => ({
  key: view.key,
  label: view.label,
  icon: view.icon,
}));

const bottomChromeState = computed(() => {
  if (chromeHidden.value && chromeProgress.value <= 0.001) return "hidden";
  if (chromeHidden.value && chromeProgress.value < 0.999) return "progress";
  return "visible";
});

const bottomChromeStyle = computed(() => ({
  "--bottom-chrome-visibility-progress": String(chromeHidden.value ? chromeProgress.value : 1),
}));

function isAppViewKey(key: string): key is AppViewKey {
  return appViews.some((view) => view.key === key);
}

function normalizeProgress(value: unknown) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.min(1, Math.max(0, numberValue));
}

function handleChromeChange(payload: ChromeStatePayload) {
  if (typeof payload === "boolean") {
    chromeHidden.value = payload;
    chromeProgress.value = payload ? 0 : 1;
    return;
  }

  const hidden = Boolean(payload.hidden);
  chromeHidden.value = hidden;
  chromeProgress.value = hidden ? normalizeProgress(payload.progress) : 1;
}

function handleViewChange(key: string) {
  chromeHidden.value = false;
  chromeProgress.value = 1;
  if (isAppViewKey(key)) {
    setActiveView(key);
  }
}
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
