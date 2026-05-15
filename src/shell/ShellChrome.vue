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
  "tab-select": [tabId: string, region: ShellRegionKey];
}>();

const { state } = useShellChrome();

const regionSpec = computed(() => state[props.region]);
const isVisible = computed(() => regionSpec.value.visible !== false);
const buttons = computed(() => regionSpec.value.buttons ?? []);
const filters = computed(() => regionSpec.value.filters ?? []);
const identity = computed(() => regionSpec.value.identity ?? null);
const hasTabs = computed(() => regionSpec.value.tabs != null);
const isSlottedTabs = computed(() => !hasTabs.value && regionSpec.value.slot === "tabs");

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
    :class="[`shell-chrome--${region}`, { 'shell-chrome--tabs': hasTabs || isSlottedTabs }]"
    :aria-hidden="hasTabs || isSlottedTabs ? undefined : !isVisible"
    role="complementary"
    :aria-label="region === 'top' ? '顶部操作区' : '底部操作区'"
    :data-visible="isVisible"
  >
    <template v-if="hasTabs">
      <nav
        class="shell-chrome__tabs lian-floating-chrome"
        :class="[`lian-floating-chrome--${region}`]"
        :aria-label="regionSpec.tabs?.ariaLabel ?? '标签切换'"
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
    <template v-else-if="isSlottedTabs">
      <slot />
    </template>
    <template v-else>
      <div class="shell-chrome__inner lian-floating-chrome lian-floating-chrome--top">
        <div v-if="identity" class="shell-chrome__identity" aria-label="当前身份">
          <span class="shell-chrome__identity-avatar" aria-hidden="true">{{ identity.avatarText }}</span>
          <span class="shell-chrome__identity-name">{{ identity.name }}</span>
          <span v-if="identity.meta" class="shell-chrome__identity-meta">{{ identity.meta }}</span>
        </div>
        <div class="shell-chrome__slot">
          <slot />
        </div>
        <nav v-if="filters.length" class="shell-chrome__filters" aria-label="筛选">
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
  </aside>
</template>
