<script setup lang="ts">
/**
 * Request-log readout for the DEV fixture toolbar.
 *
 * Split out of `FixtureToolbar.vue` to keep both files under the repo's Vue
 * size threshold. Purely presentational — the parent owns the state.
 */

import type { FixtureRequestLogEntry, FixtureRequestCounts } from "../types";

const props = defineProps<{
  counts: FixtureRequestCounts;
  entries: readonly FixtureRequestLogEntry[];
  open: boolean;
}>();

const emit = defineEmits<{ toggle: []; clear: [] }>();

/** Unmapped means a missing fixture (501); blocked means attempted egress. */
const hasProblem = () => props.counts.unmapped > 0 || props.counts.blocked > 0;
</script>

<template>
  <button
    type="button"
    class="fixture-log__summary"
    :aria-expanded="open"
    @click="emit('toggle')"
  >
    请求 {{ counts.total }} · 命中 {{ counts.handled }} ·
    <span :class="{ 'fixture-log__count--bad': counts.unmapped > 0 }">
      未覆盖 {{ counts.unmapped }}
    </span>
    ·
    <span :class="{ 'fixture-log__count--bad': counts.blocked > 0 }">
      拦截 {{ counts.blocked }}
    </span>
  </button>

  <p v-if="hasProblem()" class="fixture-log__hint">
    未覆盖表示该接口还没有 fixture（返回 501）；拦截表示有请求试图访问外部网络。
  </p>

  <template v-if="open">
    <ul class="fixture-log__list">
      <li v-for="entry in entries" :key="entry.id">
        <span class="fixture-log__outcome" :data-outcome="entry.outcome">
          {{ entry.outcome }}
        </span>
        <span class="fixture-log__path">{{ entry.method }} {{ entry.path }}</span>
      </li>
      <li v-if="entries.length === 0" class="fixture-log__empty">暂无请求记录</li>
    </ul>
    <button type="button" class="fixture-log__clear" @click="emit('clear')">清空日志</button>
  </template>
</template>

<style scoped>
.fixture-log__summary {
  padding: var(--space-1) var(--space-2);
  border: 0;
  border-radius: var(--radius-button);
  background: var(--lian-surface-content-muted);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.fixture-log__count--bad {
  color: var(--lian-danger);
  font-weight: 700;
}

.fixture-log__hint {
  margin: 0;
  opacity: 0.7;
  line-height: 1.5;
}

.fixture-log__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-height: 168px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.fixture-log__list li {
  display: flex;
  gap: var(--space-2);
  align-items: baseline;
}

.fixture-log__outcome {
  flex: 0 0 62px;
  font-size: 10px;
  text-transform: uppercase;
  opacity: 0.7;
}

/* Values come from `FixtureRequestLogEntry["outcome"]`. `unmapped` (not
   "unmatched") is the real key — the earlier selector never matched. */
.fixture-log__outcome[data-outcome="unmapped"],
.fixture-log__outcome[data-outcome="blocked"],
.fixture-log__outcome[data-outcome="failed"] {
  color: var(--lian-danger);
  opacity: 1;
  font-weight: 700;
}

.fixture-log__path {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  font-family: var(--font-mono, monospace);
}

.fixture-log__empty {
  opacity: 0.6;
}

.fixture-log__clear {
  min-height: 30px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-button);
  background: var(--lian-surface-content);
  color: inherit;
  font: inherit;
  cursor: pointer;
}
</style>
