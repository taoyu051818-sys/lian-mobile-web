/** 通知 UI */
export const NOTIFICATION_SECTION_LABEL = "通知";
export const NOTIFICATION_READ = "已读";
export const NOTIFICATION_UNREAD = "未读";
export const NOTIFICATION_DEFAULT_TITLE = "新通知";

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

/** 通知通道 readout */
export const NOTIFICATION_CHANNELS_LABEL = "当前收件箱来源";
export const NOTIFICATION_CHANNELS_HINT = "下面列出这个收件箱已经接入或仍在补线的消息来源。";
export const NOTIFICATION_CHANNEL_STATUS_CONNECTED = "已接入";
export const NOTIFICATION_CHANNEL_STATUS_PENDING = "未接入";
export const NOTIFICATION_CHANNEL_ISSUE_LINK_LABEL = "查看对应 issue";
export const NOTIFICATION_EMPTY_NEXT_STEP = "下一步";

export const NOTIFICATION_REPLY_INBOX_LABEL = "回复收件箱";
export const NOTIFICATION_REPLY_INBOX_HINT = "别人回复你的帖子或评论后，会集中出现在这里。";
export const NOTIFICATION_REPLY_EMPTY_TITLE = "还没有新的回复";
export const NOTIFICATION_REPLY_EMPTY_BODY =
  "先去动态、求助或活动详情里参与讨论，新的互动会自动回到这里。";

export const NOTIFICATION_SYSTEM_INBOX_LABEL = "系统收件箱";
export const NOTIFICATION_SYSTEM_INBOX_HINT = "认证结果、活动状态和审核反馈会逐步汇总到这里。";
export const NOTIFICATION_SYSTEM_EMPTY_TITLE = "系统结果会在这里收口";
export const NOTIFICATION_SYSTEM_EMPTY_BODY =
  "当前还没有新的系统反馈。未接入的类别会继续沿用摘要回退，直到对应通道补线完成。";

export const NOTIFICATION_ORDER_INBOX_LABEL = "订单收件箱";
export const NOTIFICATION_ORDER_INBOX_HINT = "跑腿、配送和争议相关的状态变更会在这里集中提醒。";
export const NOTIFICATION_ORDER_EMPTY_TITLE = "订单提醒还没有接入完成";
export const NOTIFICATION_ORDER_EMPTY_BODY =
  "订单状态目前仍以详情时间线为主。消息通道接好后，这里会成为统一的订单收件箱。";

export const NOTIFICATION_CHANNEL_REPLY_TITLE = "回复通知";
export const NOTIFICATION_CHANNEL_REPLY_DESC =
  "有人回复你的帖子时进入此处，点击直接跳转到帖子详情。";
export const NOTIFICATION_CHANNEL_ADMIN_REVIEW_TITLE = "管理员审核";
export const NOTIFICATION_CHANNEL_ADMIN_REVIEW_DESC =
  "管理员处理举报或对帖子下架时暂未推送独立的系统通知。";
export const NOTIFICATION_CHANNEL_VERIFICATION_TITLE = "认证结果";
export const NOTIFICATION_CHANNEL_VERIFICATION_DESC =
  "校园 / 商家 / 跑腿 / 实名认证通过或拒绝的结果通知。前端解析与跳转已就绪，等待后端开始推送。";
export const NOTIFICATION_CHANNEL_ERRAND_TITLE = "跑腿订单状态";
export const NOTIFICATION_CHANNEL_ERRAND_DESC =
  "订单从接单到送达的状态变更目前只在订单时间线里显示，离开页面就看不到。";
export const NOTIFICATION_CHANNEL_EVENT_TITLE = "活动完成";
export const NOTIFICATION_CHANNEL_EVENT_DESC = "活动完成、奖励发放、活动过期目前没有通知通道。";
