/** 通知 UI */
export const NOTIFICATION_SECTION_LABEL = "通知";
export const NOTIFICATION_READ = "已读";
export const NOTIFICATION_UNREAD = "未读";
export const NOTIFICATION_DEFAULT_TITLE = "新通知";

/** 通知补充 UI */
export const NOTIFICATION_REPLY_LABEL = "回复";
export const NOTIFICATION_ACTOR_LABEL = "通知";

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
