/** 通知 UI */
export const NOTIFICATION_SECTION_LABEL = "通知";
export const NOTIFICATION_READ = "已读";
export const NOTIFICATION_UNREAD = "未读";
export const NOTIFICATION_DEFAULT_TITLE = "新通知";
export const NOTIFICATION_LOAD_MORE = "加载更多通知";

/** 通知补充 UI */
export const NOTIFICATION_REPLY_LABEL = "回复";
export const NOTIFICATION_ACTOR_LABEL = "通知";

/** 通知类型徽标（NotificationList.vue notificationKindLabel） */
export const NOTIFICATION_KIND_REPLY = "回复通知";
export const NOTIFICATION_KIND_VERIFICATION = "认证结果";
export const NOTIFICATION_KIND_ORDER = "订单提醒";
export const NOTIFICATION_KIND_EVENT = "活动通知";
export const NOTIFICATION_KIND_MODERATION = "管理通知";
export const NOTIFICATION_KIND_SYSTEM = "系统通知";

/** 活动相关通知（B2 #438 / lian-mobile-web#706） */
export const NOTIF_EVENT_COMPLETED_TITLE = "活动已结束";
export const NOTIF_EVENT_COMPLETED_BODY = "「{title}」的活动已结束。";
export const NOTIF_EVENT_REWARD_SETTLED_TITLE = "活动奖励已发放";
export const NOTIF_EVENT_REWARD_SETTLED_BODY =
  "「{title}」每人发放 {perJoiner} {currency}，共 {totalPaid}。";
export const NOTIF_EVENT_EXPIRED_TITLE = "活动已过期";
export const NOTIF_EVENT_EXPIRED_BODY = "「{title}」未在结束时间前完成，已自动过期。";
/** 活动通知中事件标题缺失时的占位（避免 `「」` 的空字幕） */
export const NOTIF_EVENT_TITLE_FALLBACK = "活动";

/**
 * 跑腿订单状态通知（ps#477 / ps#495 — `errand-order-*`）。
 * 后端信封自带 title + excerpt；这里是前端兜底文案，发现 raw.title /
 * raw.excerpt 缺失或被服务端清空时使用。中文克制风格。
 */
export const NOTIF_ERRAND_ORDER_ACCEPTED_TITLE = "跑腿订单已被接单";
export const NOTIF_ERRAND_ORDER_ACCEPTED_BODY = "「{title}」已被跑腿员接单，请保持联系。";
export const NOTIF_ERRAND_ORDER_PICKED_UP_TITLE = "跑腿订单已取件";
export const NOTIF_ERRAND_ORDER_PICKED_UP_BODY = "「{title}」已取件，正在前往送达。";
export const NOTIF_ERRAND_ORDER_DELIVERING_TITLE = "跑腿订单配送中";
export const NOTIF_ERRAND_ORDER_DELIVERING_BODY = "「{title}」正在配送途中。";
export const NOTIF_ERRAND_ORDER_DELIVERED_TITLE = "跑腿订单已送达";
export const NOTIF_ERRAND_ORDER_DELIVERED_BODY = "「{title}」已送达，请尽快确认完成。";
export const NOTIF_ERRAND_ORDER_COMPLETED_TITLE = "跑腿订单已完成结算";
export const NOTIF_ERRAND_ORDER_COMPLETED_BODY = "「{title}」订单已完成，报酬已入账。";
export const NOTIF_ERRAND_ORDER_CANCELLED_TITLE = "跑腿订单已取消";
export const NOTIF_ERRAND_ORDER_CANCELLED_BODY = "「{title}」订单已取消。";
export const NOTIF_ERRAND_ORDER_REFUNDED_TITLE = "跑腿订单已退款";
export const NOTIF_ERRAND_ORDER_REFUNDED_BODY = "「{title}」订单退款已到账。";
/** 跑腿通知缺标题时的占位 */
export const NOTIF_ERRAND_ORDER_TITLE_FALLBACK = "跑腿订单";

/**
 * 管理员审核通知（ps#493 — `report-*` / `post-*`）。
 * 后端在信封里供 title + excerpt；这里是前端兜底文案，仅在 raw.title /
 * raw.excerpt 为空时使用。中文克制风格。actor 永远是 LIAN（系统），管理员
 * 真实身份和自由文本 note 都不出站。
 */
export const NOTIF_MOD_REPORT_ACCEPTED_TITLE = "举报已受理";
export const NOTIF_MOD_REPORT_ACCEPTED_BODY = "我们已受理你的举报，正在处理中。";
export const NOTIF_MOD_REPORT_IGNORED_TITLE = "举报未予立案";
export const NOTIF_MOD_REPORT_IGNORED_BODY = "经审核，本次举报暂不立案。";
export const NOTIF_MOD_REPORT_RESOLVED_TITLE = "举报已处理完毕";
export const NOTIF_MOD_REPORT_RESOLVED_BODY = "你举报的内容已处理完毕。";
export const NOTIF_MOD_POST_HIDDEN_TITLE = "您的帖子已被隐藏";
export const NOTIF_MOD_POST_HIDDEN_BODY = "管理员将该帖子转为隐藏状态。";
export const NOTIF_MOD_POST_LOCKED_TITLE = "您的帖子已被锁定";
export const NOTIF_MOD_POST_LOCKED_BODY = "该帖子已被锁定，暂时无法回复。";
export const NOTIF_MOD_POST_UNLOCKED_TITLE = "您的帖子已解除锁定";
export const NOTIF_MOD_POST_UNLOCKED_BODY = "该帖子已解除锁定，可以正常回复。";
export const NOTIF_MOD_POST_RESTORED_TITLE = "您的帖子已恢复显示";
export const NOTIF_MOD_POST_RESTORED_BODY = "该帖子已恢复正常显示。";

/**
 * Inbox section labels. Each one is what the user sees as the "this is what
 * the tab is for" headline; #828 stripped the engineering channel-readout
 * block (status pills + GitHub issue links) that used to ride above this.
 */
export const NOTIFICATION_REPLY_INBOX_LABEL = "回复收件箱";
export const NOTIFICATION_REPLY_INBOX_HINT = "别人回复你的帖子或评论后，会集中出现在这里。";
export const NOTIFICATION_REPLY_EMPTY_TITLE = "还没有新的回复";
export const NOTIFICATION_REPLY_EMPTY_BODY =
  "先去动态、求助或活动详情里参与讨论，新的互动会自动回到这里。";

export const NOTIFICATION_SYSTEM_INBOX_LABEL = "系统收件箱";
export const NOTIFICATION_SYSTEM_INBOX_HINT = "认证结果、活动状态和审核反馈会逐步汇总到这里。";
export const NOTIFICATION_SYSTEM_EMPTY_TITLE = "暂时没有新的系统反馈";
export const NOTIFICATION_SYSTEM_EMPTY_BODY =
  "认证、活动和审核结果都会在这里集中提醒，新的反馈到来时会自动出现。";

export const NOTIFICATION_ORDER_INBOX_LABEL = "订单收件箱";
export const NOTIFICATION_ORDER_INBOX_HINT = "跑腿、配送和争议相关的状态变更会在这里集中提醒。";
export const NOTIFICATION_ORDER_EMPTY_TITLE = "暂时没有新的订单提醒";
export const NOTIFICATION_ORDER_EMPTY_BODY =
  "跑腿、配送和争议相关的状态变更会在这里集中提醒，新的状态到来时会自动出现。";

/**
 * Fail-loud / login-expired surfaces (#828). The error surface is rendered
 * for every non-auth failure path (5xx, timeout, JSON malformed) so a 5xx is
 * never silently downgraded to "暂无通知". The auth-required surface is
 * rendered for 401 / 403 — its CTA routes back to the profile view's
 * AuthPanel.
 */
export const MESSAGES_ERROR_TITLE = "暂时无法加载消息";
export const MESSAGES_ERROR_BODY = "网络或服务器开了个小差，稍后再试就好。";
export const MESSAGES_ERROR_RETRY = "重新加载";
export const MESSAGES_AUTH_REQUIRED_TITLE = "登录已过期";
export const MESSAGES_AUTH_REQUIRED_BODY = "重新登录后才能查看你的消息。";
export const MESSAGES_AUTH_REQUIRED_CTA = "重新登录";
