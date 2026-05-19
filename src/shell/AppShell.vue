<script setup lang="ts">
import { computed } from "vue";
import { BottomTabBar, PageSurface } from "../ui";
import type { LianIconName } from "../ui/icons/paths";
import ShellChrome from "./ShellChrome.vue";
import ContentFrame from "./ContentFrame.vue";
import { useShellChrome } from "./useShellChrome";
import type { PageChromeSpec } from "./page-model";
import type { AppViewKey, ShellLayoutMode } from "../app/view-types";
import { APP_NAME, SHELL_MAIN_CONTENT } from "../config/brand";

export interface AppShellTab {
  key: string;
  label: string;
  icon: LianIconName;
}

defineProps<{
  activeViewKey: AppViewKey;
  layoutMode: ShellLayoutMode;
  tabs: AppShellTab[];
}>();

const emit = defineEmits<{
  "view-change": [key: string];
}>();

const { applyPageChrome, ensureBottomSlot, state } = useShellChrome();

ensureBottomSlot("tabs");

const bottomSlotKind = computed(() => state.bottom.slot);

function handleChrome(spec: PageChromeSpec) {
  applyPageChrome(spec);
}

function handleViewChange(key: string) {
  emit("view-change", key);
}
</script>

<template>
  <main class="vue-shell" :aria-label="`${APP_NAME} ${SHELL_MAIN_CONTENT}`">
    <ShellChrome region="top" />
    <ContentFrame :layout-mode="layoutMode">
      <PageSurface as="div" :padded="false">
        <slot :on-chrome="handleChrome" />
      </PageSurface>
    </ContentFrame>
    <ShellChrome region="bottom">
      <BottomTabBar
        v-if="bottomSlotKind === 'tabs'"
        class="vue-shell__bottom-tab lian-floating-chrome lian-floating-chrome--bottom"
        data-floating-chrome="bottom"
        :items="tabs"
        :active-key="activeViewKey"
        @change="handleViewChange"
      />
    </ShellChrome>
  </main>
</template>
