/**
 * Server酱 (ps#504 I2) — external notification settings + opt-in dialog copy.
 *
 * Constants for:
 *  - Profile settings section: binding state, manual paste, reminder toggles.
 *  - Event-join opt-in dialog (after successful event join).
 *  - Errand-order opt-in dialog (after successful order creation).
 *
 * The helper text under the section title is the privacy boilerplate every
 * external-notification surface owes the user — LIAN does not send marketing
 * pushes via Server酱; the channel is reserved for opt-in reminders and the
 * narrow "key state change" set (event start / reward / errand cancel-refund).
 */

/** Section header + privacy helper. */
export const SERVERCHAN_SECTION_LABEL = "外部通知 (Server酱)";
export const SERVERCHAN_SECTION_HELPER =
  "LIAN 不发送营销类外部通知。外部通知只用于活动关键变更、跑腿订单取消/退款，以及你主动开启的提醒。";

/** Binding state copy. */
export const SERVERCHAN_STATE_UNBOUND = "未绑定";
export const SERVERCHAN_STATE_BOUND = "已绑定";
export const SERVERCHAN_STATE_BOUND_DISABLED = "已绑定但已停用";
export const SERVERCHAN_BOUND_AT_PREFIX = "绑定时间：";

/** Bind / unbind primary controls. */
export const SERVERCHAN_BIND_BUTTON = "绑定 Server酱外部通知";
export const SERVERCHAN_BIND_MANUAL_HINT = "或粘贴 SendKey 手动绑定";
export const SERVERCHAN_BIND_MANUAL_OPEN = "粘贴 SendKey";
export const SERVERCHAN_BIND_MANUAL_CANCEL = "取消";
export const SERVERCHAN_BIND_MANUAL_LABEL = "Server酱 SendKey";
export const SERVERCHAN_BIND_MANUAL_PLACEHOLDER = "粘贴你的 Server酱 SendKey";
export const SERVERCHAN_BIND_MANUAL_SUBMIT = "保存 SendKey";
export const SERVERCHAN_BIND_MANUAL_SUBMITTING = "保存中…";
export const SERVERCHAN_UNBIND_BUTTON = "解绑";
export const SERVERCHAN_UNBIND_CONFIRM_PROMPT = "再次点击确认解绑";
export const SERVERCHAN_UNBIND_CONFIRM = "解绑后将不再收到外部通知，确定吗？";

/** Toast / status messages. */
export const SERVERCHAN_BIND_SUCCESS = "绑定成功";
export const SERVERCHAN_UNBIND_SUCCESS = "已解绑";
export const SERVERCHAN_BIND_KEY_INVALID = "SendKey 格式不正确";
export const SERVERCHAN_BIND_FAILED = "绑定失败，请稍后再试";
export const SERVERCHAN_UNBIND_FAILED = "解绑失败，请稍后再试";
export const SERVERCHAN_BIND_URL_FAILED = "无法打开绑定页，请稍后再试";
export const SERVERCHAN_LOAD_FAILED = "加载失败，可以稍后再试";
export const SERVERCHAN_PREFERENCES_LOAD_FAILED = "提醒设置加载失败，可以稍后再试";
export const SERVERCHAN_PREFERENCES_PATCH_FAILED = "提醒设置没有保存成功";
export const SERVERCHAN_AUTH_REQUIRED = "请先登录再绑定外部通知。";
export const SERVERCHAN_RELOAD = "重新加载";

/** Reminder toggles. */
export const SERVERCHAN_TOGGLE_EVENT_START_LABEL = "活动开始前提醒";
export const SERVERCHAN_TOGGLE_EVENT_START_HINT = "活动开始前 30 分钟通过 Server酱推送提醒。";
export const SERVERCHAN_TOGGLE_REWARD_LABEL = "奖励到账提醒";
export const SERVERCHAN_TOGGLE_REWARD_HINT = "活动奖励到账时通过 Server酱推送提醒。";

/** Event-join opt-in dialog. */
export const SERVERCHAN_DIALOG_EVENT_TITLE = "报名成功";
export const SERVERCHAN_DIALOG_EVENT_BODY = "是否在活动开始前提醒你？";
export const SERVERCHAN_DIALOG_EVENT_PRIMARY = "开启 30 分钟前提醒";
export const SERVERCHAN_DIALOG_EVENT_SECONDARY = "不用提醒";

/** Errand-order opt-in dialog. */
export const SERVERCHAN_DIALOG_ERRAND_TITLE = "订单已创建";
export const SERVERCHAN_DIALOG_ERRAND_BODY = "是否接收此订单的关键状态提醒？";
export const SERVERCHAN_DIALOG_ERRAND_PRIMARY = "接收提醒";
export const SERVERCHAN_DIALOG_ERRAND_SECONDARY = "仅站内信";

/** Dialog feedback. */
export const SERVERCHAN_DIALOG_REMINDER_ENABLED = "已开启提醒";
export const SERVERCHAN_DIALOG_REMINDER_FAILED = "提醒开启失败";

/** Aria label for the dialog overlay. */
export const SERVERCHAN_DIALOG_LABEL = "外部通知提醒提示";
