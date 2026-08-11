<script setup lang="ts">
import { computed } from "vue";

interface MerchantRow {
  id: string;
  code: string;
  displayName: string;
  status: "active" | "inactive";
  updatedAt: string;
}

const props = defineProps<{
  rows: MerchantRow[];
  limit: number;
  offset: number;
  total: number;
  requestId: string;
  loading: boolean;
  empty: boolean;
  errorCode: string;
  draftQ: string;
  status: "all" | "active" | "inactive";
  canPrevious: boolean;
  canNext: boolean;
  canRetry: boolean;
  retryBlocked: boolean;
}>();

const emit = defineEmits<{
  draftChange: [value: string];
  search: [];
  status: [value: "all" | "active" | "inactive"];
  previous: [];
  next: [];
  refresh: [];
  retry: [];
}>();

const statusOptions = [
  { value: "all", label: "全部" },
  { value: "active", label: "启用" },
  { value: "inactive", label: "停用" },
] as const;

const pageNumber = computed(() =>
  Number.isSafeInteger(props.offset) && Number.isInteger(props.limit) && props.limit > 0
    ? Math.floor(props.offset / props.limit) + 1
    : 1,
);

const errorCopy: Readonly<Record<string, string>> = Object.freeze({
  REQUEST_CONTRACT: "商户目录请求与服务约定不一致。",
  BFF_NOT_DEPLOYED: "商户目录服务尚未部署。",
  PREREQUISITE_UNAVAILABLE: "商户目录依赖服务暂不可用。",
  RATE_LIMITED: "请求过于频繁，请稍后重试。",
  INTEGRATION_UNAVAILABLE: "商户目录集成暂不可用。",
  TEMPORARILY_UNAVAILABLE: "商户目录暂不可用，请稍后重试。",
  NETWORK_FAILURE: "商户目录暂不可用，请稍后重试。",
  MALFORMED_RESPONSE: "商户目录返回了无法识别的数据。",
  HTTP_FAILURE: "商户目录暂不可用，请稍后重试。",
});

const safeErrorCopy = computed(
  () => errorCopy[props.errorCode] ?? "商户目录暂不可用，请稍后重试。",
);

function updateDraft(event: Event) {
  emit("draftChange", (event.target as HTMLInputElement).value);
}
</script>

<template>
  <section
    class="admin-la-merchants-block"
    data-testid="admin-la-merchants-block"
    aria-label="LAPlatform 商户目录"
  >
    <header class="admin-la-merchants-block__header">
      <div>
        <h2>商户目录</h2>
        <p>共 {{ total }} 个商户 · 第 {{ pageNumber }} 页</p>
      </div>
      <button
        type="button"
        class="admin-la-merchants-block__button"
        data-testid="admin-la-merchants-refresh"
        :disabled="loading"
        @click="emit('refresh')"
      >
        刷新
      </button>
    </header>

    <form class="admin-la-merchants-block__search" @submit.prevent="emit('search')">
      <label>
        <span class="admin-la-merchants-block__visually-hidden">搜索商户</span>
        <input
          :value="draftQ"
          type="search"
          maxlength="161"
          autocomplete="off"
          data-testid="admin-la-merchants-search"
          placeholder="搜索商户名称、编号或代码"
          @input="updateDraft"
        />
      </label>
      <button type="submit" class="admin-la-merchants-block__button">搜索</button>
    </form>

    <div class="admin-la-merchants-block__statuses" aria-label="商户状态筛选">
      <button
        v-for="option in statusOptions"
        :key="option.value"
        type="button"
        class="admin-la-merchants-block__status"
        :class="{ 'is-active': status === option.value }"
        :data-testid="`admin-la-merchants-status-${option.value}`"
        :disabled="loading"
        @click="emit('status', option.value)"
      >
        {{ option.label }}
      </button>
    </div>

    <p v-if="loading" class="admin-la-merchants-block__state" role="status">正在读取商户目录…</p>

    <div
      v-else-if="errorCode"
      class="admin-la-merchants-block__error"
      data-testid="admin-la-merchants-error"
      :data-code="errorCode"
      role="alert"
    >
      <p>{{ safeErrorCopy }}</p>
      <button
        v-if="canRetry || retryBlocked"
        type="button"
        class="admin-la-merchants-block__button"
        data-testid="admin-merchants-retry"
        :disabled="retryBlocked"
        @click="emit('retry')"
      >
        重试
      </button>
    </div>

    <p
      v-else-if="empty"
      class="admin-la-merchants-block__state"
      data-testid="admin-la-merchants-empty"
    >
      当前没有符合条件的商户。
    </p>

    <ul v-else class="admin-la-merchants-block__list">
      <li
        v-for="merchant in rows"
        :key="merchant.id"
        class="admin-la-merchants-block__row"
        data-testid="admin-la-merchant-row"
      >
        <div>
          <strong>{{ merchant.displayName }}</strong>
          <span>{{ merchant.status === "active" ? "启用" : "停用" }}</span>
        </div>
        <dl>
          <div>
            <dt>编号</dt>
            <dd>{{ merchant.id }}</dd>
          </div>
          <div>
            <dt>代码</dt>
            <dd>{{ merchant.code }}</dd>
          </div>
          <div>
            <dt>更新时间</dt>
            <dd>{{ merchant.updatedAt }}</dd>
          </div>
        </dl>
      </li>
    </ul>

    <footer class="admin-la-merchants-block__footer">
      <button
        type="button"
        class="admin-la-merchants-block__button"
        data-testid="admin-la-merchants-previous"
        :disabled="loading || !canPrevious"
        @click="emit('previous')"
      >
        上一页
      </button>
      <span v-if="requestId" class="admin-la-merchants-block__request">请求 {{ requestId }}</span>
      <button
        type="button"
        class="admin-la-merchants-block__button"
        data-testid="admin-la-merchants-next"
        :disabled="loading || !canNext"
        @click="emit('next')"
      >
        下一页
      </button>
    </footer>
  </section>
</template>

<style scoped>
.admin-la-merchants-block {
  display: grid;
  gap: var(--space-3);
}

.admin-la-merchants-block__header,
.admin-la-merchants-block__footer,
.admin-la-merchants-block__search,
.admin-la-merchants-block__statuses {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.admin-la-merchants-block__header,
.admin-la-merchants-block__footer {
  justify-content: space-between;
}

.admin-la-merchants-block__header h2,
.admin-la-merchants-block__header p,
.admin-la-merchants-block__error p,
.admin-la-merchants-block__row dl,
.admin-la-merchants-block__row dd {
  margin: 0;
}

.admin-la-merchants-block__header p,
.admin-la-merchants-block__request {
  color: var(--lian-muted);
  font-size: 12px;
}

.admin-la-merchants-block__search label {
  flex: 1;
}

.admin-la-merchants-block__search input {
  width: 100%;
  min-height: 40px;
  padding: 0 var(--space-3);
  border: 1px solid var(--lian-border);
  border-radius: var(--radius-3);
  background: var(--lian-card-strong);
  color: var(--lian-ink);
  font: inherit;
  box-sizing: border-box;
}

.admin-la-merchants-block__button,
.admin-la-merchants-block__status {
  min-height: 36px;
  padding: 0 var(--space-3);
  border: 1px solid var(--lian-border);
  border-radius: var(--radius-pill);
  background: var(--lian-card-strong);
  color: var(--lian-ink);
  font: inherit;
  font-weight: 800;
}

.admin-la-merchants-block__status.is-active {
  border-color: var(--lian-primary);
  color: var(--lian-primary);
}

.admin-la-merchants-block__button:disabled,
.admin-la-merchants-block__status:disabled {
  opacity: 0.48;
}

.admin-la-merchants-block__state,
.admin-la-merchants-block__error {
  margin: 0;
  padding: var(--space-4);
  border-radius: var(--radius-card);
  background: var(--lian-card-strong);
  text-align: center;
}

.admin-la-merchants-block__error {
  display: grid;
  gap: var(--space-3);
  justify-items: center;
  color: var(--lian-danger, #b91c1c);
}

.admin-la-merchants-block__list {
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.admin-la-merchants-block__row {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: var(--lian-card-strong);
}

.admin-la-merchants-block__row > div,
.admin-la-merchants-block__row dl {
  display: flex;
  gap: var(--space-3);
  justify-content: space-between;
}

.admin-la-merchants-block__row dl div {
  min-width: 0;
}

.admin-la-merchants-block__row dt {
  color: var(--lian-muted);
  font-size: 11px;
}

.admin-la-merchants-block__row dd {
  overflow-wrap: anywhere;
  font-size: 12px;
}

.admin-la-merchants-block__visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 640px) {
  .admin-la-merchants-block__row dl {
    display: grid;
  }

  .admin-la-merchants-block__request {
    display: none;
  }
}
</style>
