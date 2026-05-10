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
}>();

const { state } = useShellChrome();

const regionSpec = computed(() => state[props.region]);
const isVisible = computed(() => regionSpec.value.visible !== false);
const buttons = computed(() => regionSpec.value.buttons ?? []);
const isTabs = computed(() => regionSpec.value.slot === "tabs");

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
</script>

<template>
  <aside
    class="shell-chrome"
    :class="[`shell-chrome--${region}`, { 'shell-chrome--tabs': isTabs }]"
    :aria-hidden="isTabs ? undefined : !isVisible"
    role="complementary"
    :aria-label="region === 'top' ? '顶部操作区' : '底部操作区'"
    :data-floating-state="floatingState"
  >
    <template v-if="isTabs">
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
