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
const rendersStableTopTarget = computed(() => props.region === "top");
const rendersStableBottomTarget = computed(() => props.region === "bottom");
const rendersRegularChrome = computed(() => !isReplyDockSlot.value && !isDetailTopbarSlot.value);

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
      },
    ]"
    :aria-hidden="
      hasTabs || isSlottedTabs || isReplyDockSlot || isDetailTopbarSlot ? undefined : !isVisible
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
        'lian-floating-chrome': isDetailTopbarSlot,
        'lian-floating-chrome--top': isDetailTopbarSlot,
      }"
      :data-floating-chrome="isDetailTopbarSlot ? 'top' : undefined"
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
          :aria-label="regionSpec.tabs?.ariaLabel ?? SHELL_TAB_SWITCH"
          :aria-hidden="!isVisible"
          data-floating-chrome="top"
        >
          <button
            v-for="tab in regionSpec.tabs?.items ?? []"
            :key="tab.id"
            type="button"
            class="shell-chrome__tab"
            :class="{ 'is-active': tab.id === regionSpec.tabs?.activeKey }"
            :aria-pressed="tab.id === regionSpec.tabs?.activeKey"
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
