<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
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
let detailChromeProgressFrame = 0;

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

function stopDetailChromeProgressFollow() {
  if (typeof window !== "undefined" && detailChromeProgressFrame) {
    window.cancelAnimationFrame(detailChromeProgressFrame);
  }
  detailChromeProgressFrame = 0;
}

function readDetailCardProgress() {
  if (typeof window === "undefined") return null;
  const detailMotionHost = document.querySelector<HTMLElement>(".feed-view.is-detail-dragging, .feed-view.is-detail-returning");
  if (!detailMotionHost) return null;
  const progress = window.getComputedStyle(detailMotionHost).getPropertyValue("--detail-card-progress").trim();
  return normalizeProgress(progress);
}

function followDetailChromeProgress() {
  const progress = readDetailCardProgress();
  if (progress === null) {
    stopDetailChromeProgressFollow();
    chromeHidden.value = false;
    chromeProgress.value = 1;
    return;
  }

  chromeHidden.value = true;
  chromeProgress.value = progress;
  if (typeof window !== "undefined") {
    detailChromeProgressFrame = window.requestAnimationFrame(followDetailChromeProgress);
  }
}

function startDetailChromeProgressFollow() {
  if (typeof window === "undefined") return false;
  if (!document.querySelector(".feed-view.is-detail-open")) return false;

  stopDetailChromeProgressFollow();
  chromeHidden.value = true;
  chromeProgress.value = 0;
  detailChromeProgressFrame = window.requestAnimationFrame(followDetailChromeProgress);
  return true;
}

function handleChromeChange(payload: ChromeStatePayload) {
  if (typeof payload === "boolean") {
    if (!payload && startDetailChromeProgressFollow()) return;
    stopDetailChromeProgressFollow();
    chromeHidden.value = payload;
    chromeProgress.value = payload ? 0 : 1;
    return;
  }

  stopDetailChromeProgressFollow();
  const hidden = Boolean(payload.hidden);
  chromeHidden.value = hidden;
  chromeProgress.value = hidden ? normalizeProgress(payload.progress) : 1;
}

function handleViewChange(key: string) {
  stopDetailChromeProgressFollow();
  chromeHidden.value = false;
  chromeProgress.value = 1;
  if (isAppViewKey(key)) {
    setActiveView(key);
  }
}

onBeforeUnmount(() => {
  stopDetailChromeProgressFollow();
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
