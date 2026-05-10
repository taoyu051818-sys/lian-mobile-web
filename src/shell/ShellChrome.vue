<script setup lang="ts">
import { computed } from "vue";
import { useShellChrome } from "./useShellChrome";
import type { ShellRegionKey, ChromeButtonSpec } from "./shell-chrome-types";
import type { FloatingChromePhase } from "../motion/floatingChrome";

const props = withDefaults(defineProps<{
  region: ShellRegionKey;
  /** Current floating chrome phase for this region. Drives data-floating-state. */
  chromePhase?: FloatingChromePhase;
}>(), {
  region: "top",
  chromePhase: "visible",
});

const emit = defineEmits<{
  "button-click": [id: string, region: ShellRegionKey];
  "tab-select": [tabId: string, region: ShellRegionKey];
}>();

const { state } = useShellChrome();

const regionSpec = computed(() => state[props.region]);
const isVisible = computed(() => regionSpec.value.visible !== false);
const buttons = computed(() => regionSpec.value.buttons ?? []);
const hasTabs = computed(() => regionSpec.value.tabs != null);
const isSlottedTabs = computed(() => !hasTabs.value && regionSpec.value.slot === "tabs");

/**
 * Effective floating state for the data attribute.
 *
 * During exiting/entering transitions the chrome container should be
 * hidden and non-interactive regardless of the underlying spec's
 * `visible` flag. The spec swap happens between exiting and entering,
 * so `entering` uses the new spec's visibility.
 */
const floatingState = computed(() => {
  if (props.chromePhase === "exiting") return "exiting";
  if (props.chromePhase === "entering") return "entering";
  if (props.chromePhase === "progress") return "progress";
  if (!isVisible.value) return "hidden";
  return "visible";
});

/**
 * Pointer events are disabled during exiting and entering to prevent
 * interaction with chrome that is mid-transition. The CSS handles this
 * via `[data-floating-state]` selectors, but the attribute binding
 * here ensures the correct phase is communicated.
 */
const isTransitioning = computed(
  () => props.chromePhase === "exiting" || props.chromePhase === "entering",
);

function handleButtonClick(button: ChromeButtonSpec) {
  if (!button.disabled && !isTransitioning.value) {
    emit("button-click", button.id, props.region);
  }
}

function handleTabSelect(tabId: string) {
  if (!isTransitioning.value) {
    regionSpec.value.onTabSelect?.(tabId);
    emit("tab-select", tabId, props.region);
  }
}
</script>

<template>
  <aside
    class="shell-chrome"
    :class="[`shell-chrome--${region}`, { 'shell-chrome--tabs': hasTabs || isSlottedTabs }]"
    :aria-hidden="hasTabs || isSlottedTabs ? undefined : !isVisible"
    role="complementary"
    :aria-label="region === 'top' ? '顶部操作区' : '底部操作区'"
    :data-floating-state="floatingState"
  >
    <template v-if="hasTabs">
      <nav
        class="shell-chrome__tabs feed-view__tabs lian-floating-chrome"
        :class="[`lian-floating-chrome--${region}`]"
        :aria-label="regionSpec.tabs?.ariaLabel ?? '标签切换'"
        :aria-hidden="regionSpec.tabs?.floatingState === 'hidden'"
        :data-floating-state="regionSpec.tabs?.floatingState ?? 'visible'"
        :data-floating-chrome="region"
      >
        <button
          v-for="tab in regionSpec.tabs?.items ?? []"
          :key="tab.id"
          type="button"
          class="shell-chrome__tab feed-view__tab"
          :class="{ 'is-active': tab.id === regionSpec.tabs?.activeKey }"
          :aria-pressed="tab.id === regionSpec.tabs?.activeKey"
          @click="handleTabSelect(tab.id)"
        >
          {{ tab.label }}
        </button>
      </nav>
    </template>
    <template v-else-if="isSlottedTabs">
      <slot />
    </template>
    <template v-else>
      <div class="shell-chrome__inner">
        <div class="shell-chrome__slot">
          <slot />
        </div>
        <div v-if="buttons.length" class="shell-chrome__buttons">
          <button
            v-for="btn in buttons"
            :key="btn.id"
            class="lian-button"
            :class="[`lian-button--${btn.variant ?? 'ghost'}`]"
            :disabled="btn.disabled || isTransitioning"
            type="button"
            :aria-label="btn.label"
            @click="handleButtonClick(btn)"
          >
            {{ btn.label }}
          </button>
        </div>
      </div>
    </template>
  </aside>
</template>
