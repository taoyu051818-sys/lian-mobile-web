<script setup lang="ts">
/**
 * Trade manage block (mw#827 PR-3).
 *
 * Author-side state-machine controls for second-hand listings. Each button
 * fires an independent `PATCH /api/posts/:tid/trade-state` request; only the
 * row the user clicked spins, the others go muted.
 *
 * Button vocabulary derives from `DetailCtaButton`'s 6-state contract via
 * `selectTradeManageCtaState`, so every author CTA on the detail surface
 * shares the ARIA + visual hierarchy with the buyer-side trade contact CTA
 * and the merchant errand CTA.
 */
import { computed, ref, watch } from "vue";
import { patchTradeState } from "../../api/posts";
import { fetchAuthMe } from "../../api/profile";
import type { PostDetail } from "../../types/post";
import type { TradeState } from "../../types/post-extensions";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import DetailCtaButton from "./DetailCtaButton.vue";
import { selectTradeManageCtaState } from "./detailCtaState";
import {
  availablePostActions,
  type PostActionContext,
  type PostActionId,
} from "./postActionRegistry";

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

// Mirror of the backend state machine in
// `post-metadata-service.js#assertTradeStateTransition`. Lives here so the
// guard below can match the structure test (#649) — a transition that
// disagrees with the backend would fail the PATCH after the user clicked.
const TRADE_TRANSITIONS: Record<TradeState, TradeState[]> = {
  available: ["reserved", "sold", "cancelled", "hidden"],
  reserved: ["available", "sold", "cancelled", "hidden"],
  hidden: ["available", "cancelled"],
  sold: [],
  cancelled: [],
};

void TRADE_TRANSITIONS;

const currentUser = ref<{ id?: string; username?: string } | null>(null);
const tradeStateBusy = ref(false);
// Track which transition button is currently in-flight so only that row
// lights up `loading`. Reset on settle. The error sticks to the same row
// until the next click clears it.
const activeTransition = ref<TradeState | null>(null);
const lastErrorTransition = ref<TradeState | null>(null);

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

function ctaStateFor(target: TradeState) {
  return selectTradeManageCtaState({
    busy: tradeStateBusy.value,
    active: activeTransition.value === target,
    hasError: lastErrorTransition.value === target,
  });
}

function ctaLabelFor(target: TradeState) {
  if (tradeStateBusy.value && activeTransition.value === target) return TRADE_ACTION_PENDING;
  return TRADE_ACTION_LABELS[target];
}

function testIdFor(target: TradeState) {
  return `detail-cta-trade-set-${target}`;
}

async function handleTradeAction(nextState: TradeState) {
  const currentId = post.value?.tid;
  if (!currentId || tradeStateBusy.value) return;
  tradeStateBusy.value = true;
  activeTransition.value = nextState;
  lastErrorTransition.value = null;
  try {
    await patchTradeState(currentId, nextState);
    emit("action-message", TRADE_ACTION_SUCCESS[nextState]);
    emit("retry");
  } catch (error) {
    lastErrorTransition.value = nextState;
    emit("action-error", extractErrorMessage(error, TRADE_ACTION_ERROR));
  } finally {
    tradeStateBusy.value = false;
    activeTransition.value = null;
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
    <div class="post-detail-trade-manage__actions" data-testid="post-detail-trade-manage-action">
      <DetailCtaButton
        v-for="action in tradeActions"
        :key="action.state"
        :label="ctaLabelFor(action.state)"
        :state="ctaStateFor(action.state)"
        :test-id="testIdFor(action.state)"
        :data-tone="action.tone"
        @click="handleTradeAction(action.state)"
      />
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
</style>
