<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { BottomTabBar, ToastHost } from "./ui";
import AppViewHost from "./app/AppViewHost.vue";
import { appViews, type AppViewKey } from "./app/view-types";
import { useActiveView } from "./app/useActiveView";

type FloatingChromePhase = "visible" | "exiting" | "hidden" | "entering" | "progress";

type ChromeStatePayload = boolean | {
  hidden?: boolean;
  progress?: number;
  phase?: FloatingChromePhase;
  reason?: string;
};

const FLOATING_CHROME_PHASE_MS = 260;

const { activeViewKey, setActiveView } = useActiveView();
const chromePhase = ref<FloatingChromePhase>("visible");
const chromeProgress = ref(1);
let chromePhaseTimer: number | undefined;

const tabs = appViews.map((view) => ({
  key: view.key,
  label: view.label,
  icon: view.icon,
}));

const bottomChromeState = computed(() => chromePhase.value);

const bottomChromeStyle = computed(() => {
  const progress = chromePhase.value === "progress"
    ? chromeProgress.value
    : chromePhase.value === "hidden" || chromePhase.value === "exiting"
      ? 0
      : 1;

  return {
    "--bottom-chrome-visibility-progress": String(progress),
  };
});

function isAppViewKey(key: string): key is AppViewKey {
  return appViews.some((view) => view.key === key);
}

function normalizeProgress(value: unknown) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.min(1, Math.max(0, numberValue));
}

function clearChromePhaseTimer() {
  if (chromePhaseTimer == null) return;
  window.clearTimeout(chromePhaseTimer);
  chromePhaseTimer = undefined;
}

function settleChromePhase(nextPhase: FloatingChromePhase) {
  clearChromePhaseTimer();
  chromePhase.value = nextPhase;
  chromeProgress.value = nextPhase === "hidden" || nextPhase === "exiting" ? 0 : 1;
}

function transitionChrome(hidden: boolean) {
  clearChromePhaseTimer();

  if (hidden) {
    if (chromePhase.value === "hidden" || chromePhase.value === "exiting") {
      settleChromePhase("hidden");
      return;
    }

    chromePhase.value = "exiting";
    chromeProgress.value = 0;
    chromePhaseTimer = window.setTimeout(() => {
      settleChromePhase("hidden");
    }, FLOATING_CHROME_PHASE_MS);
    return;
  }

  if (chromePhase.value === "visible" || chromePhase.value === "entering") {
    settleChromePhase("visible");
    return;
  }

  chromePhase.value = "entering";
  chromeProgress.value = 1;
  chromePhaseTimer = window.setTimeout(() => {
    settleChromePhase("visible");
  }, FLOATING_CHROME_PHASE_MS);
}

function handleChromeChange(payload: ChromeStatePayload) {
  if (typeof payload === "boolean") {
    transitionChrome(payload);
    return;
  }

  if (payload.phase) {
    settleChromePhase(payload.phase);
    return;
  }

  const hidden = Boolean(payload.hidden);
  const progress = normalizeProgress(payload.progress);
  if (hidden && progress > 0 && progress < 1) {
    clearChromePhaseTimer();
    chromePhase.value = "progress";
    chromeProgress.value = progress;
    return;
  }

  transitionChrome(hidden);
}

function handleViewChange(key: string) {
  transitionChrome(false);
  if (isAppViewKey(key)) {
    setActiveView(key);
  }
}

onBeforeUnmount(() => {
  clearChromePhaseTimer();
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
