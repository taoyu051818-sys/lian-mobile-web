<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { patchTradeState } from "../../api/posts";
import { fetchAuthMe } from "../../api/profile";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import type { PostDetail } from "../../types/post";
import type { TradeState } from "../../types/post-extensions";
import { availablePostActions, type PostActionContext, type PostActionId } from "./postActionRegistry";

const props = defineProps<{
  post: PostDetail | null;
}>();

const emit = defineEmits<{
  retry: [];
  "action-message": [message: string];
  "action-error": [message: string];
}>();

const TRADE_MANAGE_LABEL = "二手状态管理";
const TRADE_MANAGE_HINT = "仅作者可见。状态更新后会自动刷新详情。";
const TRADE_ACTION_PENDING = "处理中…";
const TRADE_ACTION_ERROR = "二手状态暂时无法更新，可以稍后再试。";

const TRADE_ACTION_LABELS: Record<TradeState, string> = {
  available: "恢复为在售",
  reserved: "标记为已预订",
  sold: "标记为已出售",
  cancelled: "标记为已取消",
  hidden: "暂时隐藏",
};

const TRADE_ACTION_SUCCESS: Record<TradeState, string> = {
  available: "已恢复为在售。",
  reserved: "已标记为已预订。",
  sold: "已标记为已出售。",
  cancelled: "已标记为已取消。",
  hidden: "已暂时隐藏这条二手帖。",
};

const currentUser = ref<{ id?: string; username?: string } | null>(null);
const tradeStateBusy = ref(false);

const post = computed(() => props.post);
const trade = computed(() => post.value?.trade ?? null);

const tradeManageable = computed(() => {
  const currentPost = post.value;
  if (!currentPost?.trade) return false;
  if (currentPost.tradeManageable !== undefined) return currentPost.tradeManageable;
  const user = currentUser.value;
  if (!user) return false;
  return Boolean(
    (user.id && currentPost.actor?.id && user.id === currentPost.actor.id) ||
    (user.username && currentPost.actor?.username && user.username === currentPost.actor.username),
  );
});

const actionContext = computed<PostActionContext>(() => ({
  type: post.value?.type,
  viewer: {
    canManageEvent: false,
    canManageHelp: false,
    canManageTrade: tradeManageable.value,
  },
  trade: trade.value ?? undefined,
}));

function tradeStateFromAction(id: Extract<PostActionId, `trade-set-${string}`>): TradeState {
  return id.replace("trade-set-", "") as TradeState;
}

const tradeActions = computed(() => {
  return availablePostActions(actionContext.value)
    .filter((id): id is Extract<PostActionId, `trade-set-${string}`> => id.startsWith("trade-set-"))
    .map((id) => {
      const state = tradeStateFromAction(id);
      return {
        state,
        label: TRADE_ACTION_LABELS[state],
        tone: state === "cancelled" ? "danger" : state === "hidden" ? "quiet" : "default",
      };
    });
});

const showTradeManage = computed(() => tradeManageable.value && tradeActions.value.length > 0);

async function handleTradeAction(nextState: TradeState) {
  const currentId = post.value?.tid;
  if (!currentId || tradeStateBusy.value) return;
  tradeStateBusy.value = true;
  try {
    await patchTradeState(currentId, nextState);
    emit("action-message", TRADE_ACTION_SUCCESS[nextState]);
    emit("retry");
  } catch (error) {
    emit("action-error", extractErrorMessage(error, TRADE_ACTION_ERROR));
  } finally {
    tradeStateBusy.value = false;
  }
}

watch(
  post,
  async (nextPost) => {
    if (!nextPost?.trade) {
      currentUser.value = null;
      return;
    }
    try {
      const user = await fetchAuthMe();
      currentUser.value = user ? { id: user.id, username: user.username } : null;
    } catch {
      currentUser.value = null;
    }
  },
  { immediate: true },
);
</script>

<template>
  <section
    v-if="showTradeManage"
    class="post-detail-trade-manage"
    :aria-label="TRADE_MANAGE_LABEL"
    data-testid="post-detail-trade-manage"
  >
    <header class="post-detail-trade-manage__header">
      <span class="post-detail-trade-manage__title">{{ TRADE_MANAGE_LABEL }}</span>
    </header>
    <p class="post-detail-trade-manage__hint">{{ TRADE_MANAGE_HINT }}</p>
    <div class="post-detail-trade-manage__actions">
      <button
        v-for="action in tradeActions"
        :key="action.state"
        type="button"
        class="post-detail-trade-manage__button"
        :class="{
          'post-detail-trade-manage__button--danger': action.tone === 'danger',
          'post-detail-trade-manage__button--quiet': action.tone === 'quiet',
        }"
        :disabled="tradeStateBusy"
        data-testid="post-detail-trade-manage-action"
        @click="handleTradeAction(action.state)"
      >
        {{ tradeStateBusy ? TRADE_ACTION_PENDING : action.label }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.post-detail-trade-manage {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-card, 12px);
  border: 1px dashed rgba(40, 88, 165, 0.24);
  background: rgba(40, 88, 165, 0.06);
}

.post-detail-trade-manage__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.post-detail-trade-manage__title {
  color: var(--lian-ink);
  font-weight: 800;
  font-size: 13px;
  letter-spacing: 0.02em;
}

.post-detail-trade-manage__hint {
  margin: 0;
  color: var(--lian-muted);
  font-size: 12px;
}

.post-detail-trade-manage__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.post-detail-trade-manage__button {
  appearance: none;
  border: 1px solid var(--lian-line, rgba(0, 0, 0, 0.12));
  border-radius: var(--radius-chip, 999px);
  background: var(--lian-surface-1, rgba(255, 255, 255, 0.92));
  color: var(--lian-ink);
  height: 36px;
  padding: 0 var(--space-3);
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
}

.post-detail-trade-manage__button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.post-detail-trade-manage__button--danger {
  background: rgba(220, 60, 60, 0.12);
  color: #8a2020;
  border-color: rgba(220, 60, 60, 0.24);
}

.post-detail-trade-manage__button--quiet {
  background: rgba(86, 96, 117, 0.12);
  color: #3f495b;
  border-color: rgba(86, 96, 117, 0.24);
}
</style>
