/**
 * Real response shapes emitted by lian-platform-server's RC1 errand privacy
 * projection. Keep this fixture aligned with the backend exact allowlist:
 *
 * orderId merchantPostId state status title mode feePoints rewardPoints
 * totalLockedPoints createdAt
 *
 * In particular, a terminal assigned-runner detail intentionally has no
 * participant ids, locations, notes, timeline entries, or compatibility
 * money aliases. It is valid data, not a malformed full-detail response.
 */
export const TERMINAL_RUNNER_SAFE_ORDER_WIRE = Object.freeze({
  orderId: "err-terminal-safe-completed",
  merchantPostId: 99,
  state: "completed",
  status: "completed",
  title: "公开商家标题",
  mode: "dedicated",
  feePoints: 3,
  rewardPoints: 5,
  totalLockedPoints: 0,
  createdAt: "2026-08-24T00:00:00.000Z",
});

export const TERMINAL_RUNNER_SAFE_DETAIL_WIRE = Object.freeze({
  ok: true,
  order: TERMINAL_RUNNER_SAFE_ORDER_WIRE,
  timeline: [],
  notes: "",
  createdAt: TERMINAL_RUNNER_SAFE_ORDER_WIRE.createdAt,
});

export const TERMINAL_RUNNER_SAFE_MINE_WIRE = Object.freeze({
  items: [
    TERMINAL_RUNNER_SAFE_ORDER_WIRE,
    Object.freeze({
      ...TERMINAL_RUNNER_SAFE_ORDER_WIRE,
      orderId: "err-terminal-safe-cancelled",
      state: "cancelled",
      status: "cancelled",
    }),
  ],
  total: 2,
});

export const TERMINAL_RUNNER_SAFE_ORDER_KEYS = Object.freeze([
  "createdAt",
  "feePoints",
  "merchantPostId",
  "mode",
  "orderId",
  "rewardPoints",
  "state",
  "status",
  "title",
  "totalLockedPoints",
]);
