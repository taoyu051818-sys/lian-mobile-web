<script setup lang="ts">
import { computed } from "vue";
import { useShellChrome } from "./useShellChrome";
import { useFloatingChromeState } from "./floatingChromeState";
import {
  SHELL_TOP_REGION,
  SHELL_BOTTOM_REGION,
  SHELL_TAB_SWITCH,
  SHELL_CURRENT_IDENTITY,
  SHELL_FILTER,
} from "../config/brand";
import type { ShellRegionKey, ChromeButtonSpec } from "./shell-chrome-types";

const props = withDefaults(
  defineProps<{
    region?: ShellRegionKey;
  }>(),
  {
    region: "top",
  },
);

const emit = defineEmits<{
  "button-click": [id: string, region: ShellRegionKey];
  "tab-select": [tabId: string, region: ShellRegionKey];
}>();

const { state } = useShellChrome();
const { shellVisible } = useFloatingChromeState();

const regionSpec = computed(() => state[props.region]);
// Both regions stay mounted across detail open/close when they host a slot
// (reply-dock on bottom, detail-topbar on top), so the teleport targets are
// available the moment a detail panel mounts. Top without a slot still gates
// on shellVisible to preserve legacy hide-on-detail behavior for plain chrome.
const isBottom = computed(() => props.region === "bottom");
const hasSlot = computed(() => regionSpec.value.slot != null);
const isVisible = computed(() => {
  if (isBottom.value || hasSlot.value) return regionSpec.value.visible !== false;
  return regionSpec.value.visible !== false && shellVisible.value;
});
const buttons = computed(() => regionSpec.value.buttons ?? []);
const filters = computed(() => regionSpec.value.filters ?? []);
const identity = computed(() => regionSpec.value.identity ?? null);
const hasTabs = computed(() => regionSpec.value.tabs != null);
const isSlottedTabs = computed(() => !hasTabs.value && regionSpec.value.slot === "tabs");
const isReplyDockSlot = computed(() => regionSpec.value.slot === "reply-dock");
const isDetailTopbarSlot = computed(() => regionSpec.value.slot === "detail-topbar");
// Feed filter slot (option C, dual-state visibility ↔ tabs bar). FeedView
// teleports the bar into `#lian-shell-top-slot`; the shell suppresses its
// own chrome rendering and lets the slot host carry the floating-chrome
// surface so the teleported content fills it edge-to-edge.
const isFeedFilterSlot = computed(() => regionSpec.value.slot === "feed-filter");
const rendersStableTopTarget = computed(() => props.region === "top");
const rendersStableBottomTarget = computed(() => props.region === "bottom");
const rendersRegularChrome = computed(
  () => !isReplyDockSlot.value && !isDetailTopbarSlot.value && !isFeedFilterSlot.value,
);

function handleButtonClick(button: ChromeButtonSpec) {
  if (!button.disabled && isVisible.value) {
    regionSpec.value.onButtonClick?.(button.id);
    emit("button-click", button.id, props.region);
  }
}

function handleTabSelect(tabId: string) {
  if (isVisible.value) {
    regionSpec.value.onTabSelect?.(tabId);
    emit("tab-select", tabId, props.region);
  }
}

function handleFilterToggle(filterId: string) {
  if (isVisible.value) {
    regionSpec.value.onFilterToggle?.(filterId);
  }
}
</script>

<template>
  <aside
    class="shell-chrome"
    :class="[
      `shell-chrome--${region}`,
      {
        'shell-chrome--tabs': hasTabs || isSlottedTabs,
        'shell-chrome--reply-dock': isReplyDockSlot,
        'shell-chrome--detail-topbar': isDetailTopbarSlot,
        'shell-chrome--feed-filter': isFeedFilterSlot,
      },
    ]"
    :aria-hidden="
      hasTabs || isSlottedTabs || isReplyDockSlot || isDetailTopbarSlot || isFeedFilterSlot
        ? undefined
        : !isVisible
    "
    role="complementary"
    :aria-label="region === 'top' ? SHELL_TOP_REGION : SHELL_BOTTOM_REGION"
    :data-visible="isVisible"
    :style="{ pointerEvents: isVisible ? 'auto' : 'none' }"
  >
    <div
      v-if="rendersStableTopTarget"
      id="lian-shell-top-slot"
      class="shell-chrome__top-slot"
      :class="{
        'lian-floating-chrome': isDetailTopbarSlot || isFeedFilterSlot,
        'lian-floating-chrome--top': isDetailTopbarSlot || isFeedFilterSlot,
      }"
      :data-floating-chrome="isDetailTopbarSlot || isFeedFilterSlot ? 'top' : undefined"
    />
    <div
      v-if="rendersStableBottomTarget"
      id="lian-shell-bottom-slot"
      class="shell-chrome__bottom-slot"
      :class="{
        'lian-floating-chrome': isReplyDockSlot,
        'lian-floating-chrome--bottom': isReplyDockSlot,
      }"
      :data-floating-chrome="isReplyDockSlot ? 'bottom' : undefined"
    />
    <Transition v-if="rendersRegularChrome" :name="`shell-slot-${region}`" mode="out-in">
      <template v-if="isSlottedTabs">
        <div key="tabs-slot" class="shell-chrome__slot-host">
          <slot />
        </div>
      </template>
      <template v-else-if="hasTabs">
        <nav
          key="tabs-typed"
          class="shell-chrome__tabs lian-floating-chrome"
          :class="[`lian-floating-chrome--${region}`]"
          role="tablist"
          :aria-label="regionSpec.tabs?.ariaLabel ?? SHELL_TAB_SWITCH"
          :aria-hidden="!isVisible"
          data-floating-chrome="top"
        >
          <button
            v-for="tab in regionSpec.tabs?.items ?? []"
            :key="tab.id"
            type="button"
            role="tab"
            class="shell-chrome__tab"
            :class="{ 'is-active': tab.id === regionSpec.tabs?.activeKey }"
            :aria-selected="tab.id === regionSpec.tabs?.activeKey"
            :data-testid="`shell-chrome-tab-${tab.id}`"
            @click="handleTabSelect(tab.id)"
          >
            {{ tab.label }}
          </button>
        </nav>
      </template>
      <template v-else>
        <div
          key="default"
          class="shell-chrome__inner lian-floating-chrome lian-floating-chrome--top"
        >
          <div v-if="identity" class="shell-chrome__identity" :aria-label="SHELL_CURRENT_IDENTITY">
            <span class="shell-chrome__identity-avatar" aria-hidden="true">{{
              identity.avatarText
            }}</span>
            <span class="shell-chrome__identity-name">{{ identity.name }}</span>
            <span v-if="identity.meta" class="shell-chrome__identity-meta">{{
              identity.meta
            }}</span>
          </div>
          <div class="shell-chrome__slot">
            <slot />
          </div>
          <nav v-if="filters.length" class="shell-chrome__filters" :aria-label="SHELL_FILTER">
            <button
              v-for="f in filters"
              :key="f.id"
              type="button"
              class="shell-chrome__filter"
              :class="{ 'is-active': f.active }"
              :aria-pressed="f.active"
              @click="handleFilterToggle(f.id)"
            >
              {{ f.active ? `✓ ${f.label}` : f.label }}
            </button>
          </nav>
          <div v-if="buttons.length" class="shell-chrome__buttons">
            <button
              v-for="btn in buttons"
              :key="btn.id"
              class="lian-button"
              :class="[`lian-button--${btn.variant ?? 'ghost'}`]"
              :disabled="btn.disabled || !isVisible"
              type="button"
              :aria-label="btn.label"
              @click="handleButtonClick(btn)"
            >
              {{ btn.label }}
            </button>
          </div>
        </div>
      </template>
    </Transition>
  </aside>
</template>
