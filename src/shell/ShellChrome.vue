<script setup lang="ts">
import { computed } from "vue";
import { useShellChrome } from "./useShellChrome";
import type { ShellRegionKey, ChromeButtonSpec } from "./shell-chrome-types";

const props = withDefaults(defineProps<{
  region: ShellRegionKey;
}>(), {
  region: "top",
});

const emit = defineEmits<{
  "button-click": [id: string, region: ShellRegionKey];
}>();

const { state } = useShellChrome();

const regionSpec = computed(() => state[props.region]);
const isVisible = computed(() => regionSpec.value.visible !== false);
const buttons = computed(() => regionSpec.value.buttons ?? []);

function handleButtonClick(button: ChromeButtonSpec) {
  if (!button.disabled) {
    emit("button-click", button.id, props.region);
  }
}
</script>

<template>
  <aside
    class="shell-chrome"
    :class="`shell-chrome--${region}`"
    :aria-hidden="!isVisible"
    role="complementary"
    :aria-label="region === 'top' ? '顶部操作区' : '底部操作区'"
  >
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
          :disabled="btn.disabled"
          type="button"
          :aria-label="btn.label"
          @click="handleButtonClick(btn)"
        >
          {{ btn.label }}
        </button>
      </div>
    </div>
  </aside>
</template>
