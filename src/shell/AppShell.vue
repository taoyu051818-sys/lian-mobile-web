<script setup lang="ts">
import { computed, onBeforeUnmount } from "vue";
import { BottomTabBar, PageSurface } from "../ui";
import type { LianIconName } from "../ui/icons/paths";
import ShellChrome from "./ShellChrome.vue";
import ContentFrame from "./ContentFrame.vue";
import { useShellChrome } from "./useShellChrome";
import { type FloatingChromeCommand, useFloatingChromeController } from "../motion/floatingChrome";
import type { AppViewKey, ShellLayoutMode } from "../app/view-types";

export interface AppShellTab {
  key: string;
  label: string;
  icon: LianIconName;
}

const props = defineProps<{
  activeViewKey: AppViewKey;
  layoutMode: ShellLayoutMode;
  tabs: AppShellTab[];
}>();

const emit = defineEmits<{
  "view-change": [key: string];
}>();

const { setRegion } = useShellChrome();
const appBottomChrome = useFloatingChromeController({ initialPhase: "visible" });

setRegion("bottom", { slot: "tabs" });

const bottomChromeState = computed(() => appBottomChrome.phase.value);
const bottomChromeStyle = computed(() => appBottomChrome.style.value);
const chromeProgress = computed(() => appBottomChrome.progress.value);

function handleChromeChange(payload: FloatingChromeCommand) {
  appBottomChrome.apply(payload);
}

function handleViewChange(key: string) {
  appBottomChrome.show();
  emit("view-change", key);
}

onBeforeUnmount(() => {
  appBottomChrome.dispose();
});
</script>

<template>
  <main class="vue-shell" aria-label="LIAN 主内容">
    <ShellChrome region="top" />
    <ContentFrame :layout-mode="layoutMode">
      <PageSurface as="div" :padded="false">
        <slot :on-chrome="handleChromeChange" />
      </PageSurface>
    </ContentFrame>
    <ShellChrome region="bottom">
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
    </ShellChrome>
  </main>
</template>
