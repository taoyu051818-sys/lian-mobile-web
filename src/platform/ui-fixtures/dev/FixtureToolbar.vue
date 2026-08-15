<script setup lang="ts">
/**
 * DEV-only fixture control surface.
 *
 * Mounted exclusively by `mountFixtureToolbar()`, which is itself behind the
 * `import.meta.env.DEV && VITE_UI_FIXTURES === "true"` guard, so this component
 * never reaches a production bundle.
 *
 * It deliberately renders into a `Teleport` at `body` with a z-index above the
 * app shell: the whole point is to stay reachable while any sheet, dialog, or
 * bottom-nav surface is open.
 */

import { computed, onBeforeUnmount, ref, shallowRef } from "vue";

import {
  clearFixtureRequestLog,
  getFixtureRequestCounts,
  getFixtureRequestLog,
  getFixtureState,
  resetFixtureState,
  setFixtureState,
  subscribeFixtureState,
} from "../state";
import {
  FIXTURE_IDENTITIES,
  FIXTURE_SCENARIOS,
  FIXTURE_VOLUMES,
  SHAPING_SCENARIOS,
  TRANSPORT_SCENARIOS,
  type FixtureIdentity,
  type FixtureScenario,
  type FixtureVolume,
} from "../types";

// Exhaustive by type: adding a FixtureScenario without a label fails typecheck.
const SCENARIO_LABELS: Record<FixtureScenario, string> = {
  normal: "正常",
  empty: "空数据",
  "partial-data": "缺可选字段",
  "long-copy": "超长文案",
  "many-items": "大量条目",
  loading: "加载中",
  error: "请求失败",
  "not-found": "404",
  forbidden: "无权限",
  unauthorized: "未登录",
  timeout: "请求超时",
  "rate-limited": "限流",
};

const IDENTITY_LABELS: Record<FixtureIdentity, string> = {
  guest: "游客",
  registered: "已注册（未认证）",
  "verified-student": "在校学生",
  "merchant-pending": "商家（待审核）",
  "merchant-approved": "商家（已通过）",
  runner: "骑手",
  "organization-member": "社团成员",
  admin: "管理员",
  "disabled-user": "已封禁",
};

const VOLUME_LABELS: Record<FixtureVolume, string> = {
  sparse: "少",
  default: "中",
  dense: "多",
};

const state = shallowRef(getFixtureState());
const counts = ref(getFixtureRequestCounts());
const logOpen = ref(false);

/**
 * Every switch reloads the page, so the open/closed state has to survive the
 * reload or the panel would collapse after each change.
 */
const PANEL_KEY = "lian.fixture.toolbar.open";
const collapsed = ref(readPanelClosed());

function readPanelClosed(): boolean {
  try {
    return window.localStorage.getItem(PANEL_KEY) !== "open";
  } catch {
    return true;
  }
}

function togglePanel() {
  collapsed.value = !collapsed.value;
  try {
    window.localStorage.setItem(PANEL_KEY, collapsed.value ? "closed" : "open");
  } catch {
    /* private mode: panel just won't remember, which is harmless */
  }
}

// The store is framework-free, so bridge its subscription into refs rather than
// making the store itself depend on Vue.
const stop = subscribeFixtureState(() => {
  state.value = getFixtureState();
  counts.value = getFixtureRequestCounts();
});
onBeforeUnmount(stop);

const unmappedCount = computed(() => counts.value.unmapped);
const blockedCount = computed(() => counts.value.blocked);
/** Unmapped or blocked traffic is the signal that coverage or isolation broke. */
const hasProblem = computed(() => unmappedCount.value > 0 || blockedCount.value > 0);
/** Log lives in the store, not in the state object. */
const recentLog = computed(() => getFixtureRequestLog().slice(-12).reverse());

/**
 * Fixture state is read at request time, and the feature composables cache
 * their first read — so flipping scenario alone leaves already-rendered views
 * showing stale data. Selection is persisted to localStorage and rehydrated on
 * boot, so a reload is what actually re-drives every view through the new
 * scenario. Toggles that only affect future requests (latency) skip it.
 */
function reloadIntoNewState() {
  if (typeof window !== "undefined") window.location.reload();
}

function applyScenario(event: Event) {
  const value = (event.target as HTMLSelectElement).value as FixtureScenario;
  setFixtureState({ scenario: value });
  reloadIntoNewState();
}

function applyIdentity(event: Event) {
  const value = (event.target as HTMLSelectElement).value as FixtureIdentity;
  setFixtureState({ identity: value });
  reloadIntoNewState();
}

function applyVolume(value: FixtureVolume) {
  setFixtureState({ volume: value });
  reloadIntoNewState();
}

function toggleLatency() {
  setFixtureState({ latencyMs: state.value.latencyMs > 0 ? 0 : 600 });
}

function resetAll() {
  resetFixtureState();
  clearFixtureRequestLog();
  reloadIntoNewState();
}
</script>

<template>
  <Teleport to="body">
    <aside
      class="fixture-toolbar"
      :class="{ 'fixture-toolbar--collapsed': collapsed }"
      aria-label="Fixture 预览控制台"
    >
      <button
        type="button"
        class="fixture-toolbar__handle"
        :class="{ 'fixture-toolbar__handle--alert': hasProblem }"
        :aria-expanded="!collapsed"
        @click="togglePanel"
      >
        <span class="fixture-toolbar__handle-label">FIXTURE</span>
        <span class="fixture-toolbar__handle-state">{{
          SCENARIO_LABELS[state.scenario] ?? state.scenario
        }}</span>
        <span v-if="hasProblem" class="fixture-toolbar__badge">
          {{ unmappedCount + blockedCount }}
        </span>
      </button>

      <div v-if="!collapsed" class="fixture-toolbar__body">
        <label class="fixture-toolbar__field">
          <span class="fixture-toolbar__label">场景</span>
          <select class="fixture-toolbar__select" :value="state.scenario" @change="applyScenario">
            <optgroup label="数据形态">
              <option v-for="name in SHAPING_SCENARIOS" :key="name" :value="name">
                {{ SCENARIO_LABELS[name] ?? name }}
              </option>
            </optgroup>
            <optgroup label="传输状态">
              <option v-for="name in TRANSPORT_SCENARIOS" :key="name" :value="name">
                {{ SCENARIO_LABELS[name] ?? name }}
              </option>
            </optgroup>
          </select>
        </label>

        <label class="fixture-toolbar__field">
          <span class="fixture-toolbar__label">身份</span>
          <select class="fixture-toolbar__select" :value="state.identity" @change="applyIdentity">
            <option v-for="name in FIXTURE_IDENTITIES" :key="name" :value="name">
              {{ IDENTITY_LABELS[name] }}
            </option>
          </select>
        </label>

        <div class="fixture-toolbar__field">
          <span class="fixture-toolbar__label">数量</span>
          <div class="fixture-toolbar__segment" role="group" aria-label="数据量">
            <button
              v-for="name in FIXTURE_VOLUMES"
              :key="name"
              type="button"
              class="fixture-toolbar__segment-button"
              :class="{ 'is-active': state.volume === name }"
              :aria-pressed="state.volume === name"
              @click="applyVolume(name)"
            >
              {{ VOLUME_LABELS[name] }}
            </button>
          </div>
        </div>

        <div class="fixture-toolbar__row">
          <button
            type="button"
            class="fixture-toolbar__button"
            :class="{ 'is-active': state.latencyMs > 0 }"
            :aria-pressed="state.latencyMs > 0"
            @click="toggleLatency"
          >
            延迟 {{ state.latencyMs > 0 ? `${state.latencyMs}ms` : "关" }}
          </button>
          <button type="button" class="fixture-toolbar__button" @click="resetAll">重置</button>
        </div>

        <button
          type="button"
          class="fixture-toolbar__log-toggle"
          :aria-expanded="logOpen"
          @click="logOpen = !logOpen"
        >
          请求 {{ counts.total }} · 命中 {{ counts.handled }} ·
          <span :class="{ 'fixture-toolbar__count--bad': unmappedCount > 0 }">
            未覆盖 {{ unmappedCount }}
          </span>
          ·
          <span :class="{ 'fixture-toolbar__count--bad': blockedCount > 0 }">
            拦截 {{ blockedCount }}
          </span>
        </button>

        <p v-if="hasProblem" class="fixture-toolbar__hint">
          未覆盖表示该接口还没有 fixture（返回 501）；拦截表示有请求试图访问外部网络。
        </p>

        <ul v-if="logOpen" class="fixture-toolbar__log">
          <li v-for="entry in recentLog" :key="entry.id">
            <span class="fixture-toolbar__log-outcome" :data-outcome="entry.outcome">
              {{ entry.outcome }}
            </span>
            <span class="fixture-toolbar__log-path">{{ entry.method }} {{ entry.path }}</span>
          </li>
          <li v-if="recentLog.length === 0" class="fixture-toolbar__log-empty">暂无请求记录</li>
        </ul>
      </div>
    </aside>
  </Teleport>
</template>

<style scoped>
.fixture-toolbar {
  position: fixed;
  left: var(--space-3);
  bottom: calc(var(--space-3) + env(safe-area-inset-bottom, 0px));
  /* Above every app surface, including sheets, so it stays usable. */
  z-index: calc(var(--z-toast) + 10);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: min(300px, calc(100vw - var(--space-3) * 2));
  padding: var(--space-2);
  border-radius: var(--radius-card);
  border: 1px solid var(--glass-border);
  /* A dev console must stay readable over arbitrary page content, so this is
     an opaque surface rather than one of the translucent glass tokens. */
  background: var(--paper);
  box-shadow: var(--shadow-floating);
  font-size: 12px;
  line-height: 1.5;
  color: var(--lian-ink);
}

.fixture-toolbar--collapsed {
  width: auto;
  padding: var(--space-1);
}

.fixture-toolbar__handle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 32px;
  padding: 0 var(--space-2);
  border: 0;
  border-radius: var(--radius-chip);
  background: var(--lian-surface-content);
  color: var(--lian-ink);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.fixture-toolbar__handle--alert {
  background: var(--lian-warning);
}

.fixture-toolbar__handle-label {
  letter-spacing: 0.08em;
  font-size: 10px;
  opacity: 0.7;
}

.fixture-toolbar__handle-state {
  font-weight: 600;
}

.fixture-toolbar__badge {
  min-width: 18px;
  padding: 0 5px;
  border-radius: var(--radius-chip);
  background: var(--lian-danger);
  color: var(--paper);
  text-align: center;
  font-size: 10px;
  line-height: 18px;
}

.fixture-toolbar__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* Label above control: at 300px wide, a side-by-side label pushed the long
   identity strings (e.g. "商家（待审核）") out of the panel. */
.fixture-toolbar__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.fixture-toolbar__label {
  font-size: 10px;
  letter-spacing: 0.04em;
  opacity: 0.6;
}

.fixture-toolbar__select {
  width: 100%;
  min-width: 0;
  min-height: 30px;
  padding: 0 var(--space-2);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-button);
  background: var(--lian-surface-content);
  color: inherit;
  font: inherit;
}

.fixture-toolbar__segment {
  display: flex;
  width: 100%;
  gap: var(--space-1);
}

.fixture-toolbar__segment-button,
.fixture-toolbar__button {
  flex: 1;
  min-height: 30px;
  padding: 0 var(--space-2);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-button);
  background: var(--lian-surface-content);
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.fixture-toolbar__segment-button.is-active,
.fixture-toolbar__button.is-active {
  background: var(--lian-ink);
  color: var(--paper);
  border-color: var(--lian-ink);
}

.fixture-toolbar__row {
  display: flex;
  gap: var(--space-2);
}

.fixture-toolbar__log-toggle {
  padding: var(--space-1) var(--space-2);
  border: 0;
  border-radius: var(--radius-button);
  background: var(--lian-surface-content-muted);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.fixture-toolbar__count--bad {
  color: var(--lian-danger);
  font-weight: 700;
}

.fixture-toolbar__hint {
  margin: 0;
  opacity: 0.7;
  line-height: 1.5;
}

.fixture-toolbar__log {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-height: 168px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.fixture-toolbar__log li {
  display: flex;
  gap: var(--space-2);
  align-items: baseline;
}

.fixture-toolbar__log-outcome {
  flex: 0 0 62px;
  font-size: 10px;
  text-transform: uppercase;
  opacity: 0.7;
}

.fixture-toolbar__log-outcome[data-outcome="unmatched"],
.fixture-toolbar__log-outcome[data-outcome="blocked"] {
  color: var(--lian-danger);
  opacity: 1;
  font-weight: 700;
}

.fixture-toolbar__log-path {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  font-family: var(--font-mono, monospace);
}

.fixture-toolbar__log-empty {
  opacity: 0.6;
}

@media (prefers-reduced-motion: reduce) {
  .fixture-toolbar {
    transition: none;
  }
}
</style>
