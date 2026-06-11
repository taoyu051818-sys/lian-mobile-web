/** 帖子详情 topbar */
export const POST_DETAIL_CLOSE = "关闭详情";
export const POST_DETAIL_AUTHOR_AVATAR = "作者头像";
export const POST_DETAIL_SHARE = "分享";

/** 帖子详情对话框 */
export const POST_DETAIL_DIALOG_LABEL = "帖子详情";

/** 回复 dock UI */
export const REPLY_DOCK_PLACEHOLDER = "写回复";
export const REPLY_DOCK_SEND = "发送";
export const REPLY_DOCK_REPLY = "回复";

/** 回复 UI */
export const REPLY_SECTION_TITLE = "回复";
export const REPLY_COUNT_LABEL = "条";
export const REPLY_EMPTY_PROMPT = "还没有回复，来写第一条。";

/** 回复排序 */
export const REPLY_SORT_LABEL = "回复排序";
export const REPLY_SORT_NEWEST = "最新";
export const REPLY_SORT_OLDEST = "最早";

/** 详情弹层 UI */
export const DETAIL_SHEET_LABEL = "详情弹层";
export const DETAIL_SHEET_TITLE = "详情";

/** 举报 UI */
export const REPORT_SECTION_LABEL = "举报原因";
export const REPORT_REASON_LABEL = "举报原因";
export const REPORT_REASON_NOTE = "补充说明（可选）";
export const REPORT_REASON_HINT = "补充说明只会跟随这次举报一起提交，不会公开显示。";
export const REPORT_SUBMIT = "提交举报";
export const REPORT_HIDE_LABEL = "暂时隐藏";
export const REPORT_HIDE_HINT = "如果你现在不想继续看到这条内容，可以先在当前会话里把它隐藏。";

/** 隐藏状态 UI */
export const HIDDEN_STATE_LABEL = "当前会话已隐藏内容";
export const HIDDEN_STATE_TITLE = "这条内容已在当前会话中隐藏";
export const HIDDEN_STATE_DESCRIPTION =
  "这只是当前设备上的临时隐藏，不会替代平台审核，也不会同步到其他设备。";
export const HIDDEN_STATE_UNDO = "撤销隐藏";

/** 地点弹层 UI */
export const PLACE_SHEET_COLLAPSE = "收起";
export const PLACE_SHEET_RETRY = "重试";
export const PLACE_SHEET_SETTLING = "这个地点还在沉淀信息。";
export const DETAIL_RELOAD = "重新加载";

/** 信息条 UI */
export const INFO_STRIP_LABEL = "帖子属性";
export const REPORT_TOGGLE_OPEN = "举报";
export const REPORT_TOGGLE_CLOSE = "收起";

/** 可见范围标签 */
export const INFO_STRIP_VISIBILITY_CAMPUS = "校区可见";
export const INFO_STRIP_VISIBILITY_SCHOOL = "学校可见";
export const INFO_STRIP_VISIBILITY_PRIVATE = "私密";
export const INFO_STRIP_VISIBILITY_LINK_ONLY = "仅链接";

/** 地点弹层统计 */
export const DETAIL_PLACE_SHEET_LABEL = "地点信息";
export const PLACE_SHEET_STATS_LABEL = "地点统计";
export const PLACE_SHEET_UPDATED_PREFIX = "更新于";
export const PLACE_SHEET_POST_COUNT_SUFFIX = "条内容";
export const PLACE_SHEET_CORRECTION_SUFFIX = "条修正";
export const PLACE_SHEET_SAVED_SUFFIX = "次收藏";

/** 举报/隐藏反馈 */
export const REPORT_UNHIDDEN_MESSAGE = "这条内容已经恢复显示。";
export const REPORT_SUBMITTED_MESSAGE = "举报已提交。你也可以先暂时隐藏这条内容。";

/** 回复 */
export const REPLY_IDENTITY_LABEL = "以当前身份回复";

/** 事件详情 (PRD V0.1 §6.3) */
export const EVENT_BLOCK_LABEL = "活动信息";
export const EVENT_STATUS_OPEN = "报名中";
export const EVENT_STATUS_FULL = "已满员";
export const EVENT_STATUS_CLOSED = "已关闭";
export const EVENT_STATUS_COMPLETED = "已结束";
export const EVENT_STATUS_CANCELLED = "已取消";
export const EVENT_TIME_RANGE_SEPARATOR = "至";
export const EVENT_PARTICIPANT_PREFIX = "已报名";
export const EVENT_PARTICIPANT_OF = "/";
export const EVENT_CAPACITY_UNLIMITED = "不限";
export const EVENT_JOIN = "报名";
export const EVENT_CANCEL_JOIN = "取消报名";
export const EVENT_JOIN_PENDING = "处理中…";
export const EVENT_DISABLED_NOT_OPEN = "当前不在报名期";
export const EVENT_DISABLED_FULL = "名额已满";
export const EVENT_DISABLED_OUT_OF_SCOPE = "不在参与范围内";
export const EVENT_ACTION_UNAVAILABLE = "活动操作暂时不可用，可以稍后再试。";
export const EVENT_JOIN_SUCCESS = "已报名，期待你来。";
export const EVENT_CANCEL_SUCCESS = "已取消报名。";
export const EVENT_REWARD_LABEL = "奖励说明";

/** 活动奖励结算后的只读展示（issue #705 / PRD V0.1 §6.3） */
export const EVENT_REWARD_SETTLED_LABEL = "奖励已结算";
export const EVENT_REWARD_SETTLED_PER_JOINER = "每人 {amount} 积分";
export const EVENT_REWARD_SETTLED_TOTAL = "共发放 {total} 积分给 {count} 位参与者";
export const EVENT_REWARD_SETTLED_AT = "结算于 {at}";

/** 活动结束（创建者/管理员动作 — issue #703 / PRD V0.1 §6.3） */
export const EVENT_COMPLETE_BUTTON_LABEL = "结束活动";
export const EVENT_COMPLETE_CONFIRM_TITLE = "结束这场活动？";
export const EVENT_COMPLETE_CONFIRM_BODY = "结束后名单将被冻结，状态会更新为已结束，且无法撤销。";
export const EVENT_COMPLETE_CONFIRM = "确认结束";
export const EVENT_COMPLETE_CANCEL = "再想想";
export const EVENT_COMPLETE_PENDING = "结束中…";
export const EVENT_COMPLETE_SUCCESS = "活动已结束。";
export const EVENT_COMPLETE_UNAVAILABLE = "结束活动暂时不可用，可以稍后再试。";

/** 求助详情 (PRD V0.1 §6.5 / §11.3) */
export const HELP_BLOCK_LABEL = "求助信息";
export const HELP_STATUS_OPEN = "求助中";
export const HELP_STATUS_LINKED_EVENT = "已关联活动";
export const HELP_STATUS_RESOLVED = "已解决";
export const HELP_STATUS_CLOSED = "已关闭";
export const HELP_VOTE_COUNT_PREFIX = "投票数";
export const HELP_VOTE = "我也需要";
export const HELP_UNVOTE = "取消支持";
export const HELP_VOTE_PENDING = "处理中…";
export const HELP_DISABLED_RESOLVED = "求助已解决";
export const HELP_DISABLED_CLOSED = "求助已关闭";
export const HELP_DISABLED_NOT_SIGNED_IN = "登录后可以投票支持";
export const HELP_LINKED_EVENT_LABEL = "查看关联活动";
export const HELP_ACTION_UNAVAILABLE = "求助操作暂时不可用，可以稍后再试。";
export const HELP_VOTE_SUCCESS = "已支持，谢谢。";
export const HELP_UNVOTE_SUCCESS = "已取消支持。";

export const GROUPBUY_BLOCK_LABEL = "拼单信息";
export const GROUPBUY_STATE_FORMING = "拼单中";
export const GROUPBUY_STATE_SUCCESS = "已成团";
export const GROUPBUY_STATE_FAILED = "未成团";
export const GROUPBUY_STATE_CLOSED = "已结束";
export const GROUPBUY_STATE_UNKNOWN_PREFIX = "状态";
export const GROUPBUY_PARTICIPANT_LABEL = "参与人数";
export const GROUPBUY_TARGET_UNSET = "待确认";
export const GROUPBUY_JOINED = "已参与";
export const GROUPBUY_JOIN_CTA = "我想参与";
export const GROUPBUY_CHANNEL_LABEL = "频道入口";
export const GROUPBUY_CHANNEL_PREFIX = "进入频道";
export const GROUPBUY_SETTLEMENT_HINT = "拼单结算与支付以后端开放为准，当前先在频道里确认细节。";

/**
 * PRD V0.3 §2.4 — 帖子图谱 relations 渲染。`type` 是后端 source-of-truth，
 * 前端只做人类可读的标签映射；未知 type 直接展示原始字面量。
 */
export const RELATIONS_BLOCK_LABEL = "相关";
export const RELATION_TARGET_RESOURCE_PREFIX = "资源";
export const RELATION_TYPE_HELP_EVENT_LINK = "关联活动";
export const RELATION_TYPE_SOLUTION_EVENT = "解决方案活动";
export const RELATION_TYPE_EVENT_RECAP = "活动回顾";
export const RELATION_TYPE_MERCHANT_ERRAND = "代办";
export const RELATION_TYPE_PROJECT_SUBMISSION = "项目投稿";
export const RELATION_TYPE_PROJECT_REVIEW = "项目评审";
export const RELATION_TYPE_SUBMISSION_REVIEW = "投稿评审";
export const RELATION_TYPE_EVENT_REWARD = "活动奖励";
export const RELATION_TYPE_GROUPBUY_JOINED = "参与拼单";
export const RELATION_TYPE_GROUPBUY_CREATED = "发起拼单";

/**
 * PRD V0.3 §2.4 — 后端授权动作渲染。`type` 同 relations，前端做 fallback
 * 标签；`enabled === false` 时按钮 disabled，悬浮提示展示 reasonText/reason。
 */
export const AVAILABLE_ACTIONS_BLOCK_LABEL = "可用操作";
export const AVAILABLE_ACTION_MARK_SOLVED = "标记为已解决";
export const AVAILABLE_ACTION_CLAIM_REWARD = "领取奖励";
export const AVAILABLE_ACTION_COMPLETE_ERRAND = "完成代办";
export const AVAILABLE_ACTION_TRADE_RESERVE = "预约交易";
export const AVAILABLE_ACTION_MESSAGE_AUTHOR = "联系发布者";
export const AVAILABLE_ACTION_OPEN_SUBMISSION = "查看投稿";
export const AVAILABLE_ACTION_REQUEST_REVIEW = "请求评审";
export const AVAILABLE_ACTION_SUBMIT_REVISION = "提交修改";
export const AVAILABLE_ACTION_APPROVE_SUBMISSION = "通过投稿";

/** 求助管理写侧 (PRD V0.1 §6.5 / §11.3) */
export const HELP_MANAGE_BLOCK_LABEL = "求助管理";
export const HELP_MANAGE_LINK_EVENT = "关联到活动";
export const HELP_MANAGE_LINK_EVENT_PLACEHOLDER = "输入活动帖 ID";
export const HELP_MANAGE_LINK_EVENT_HINT = "把这条求助关联到一个已发布的活动帖。";
export const HELP_MANAGE_LINK_EVENT_INVALID = "活动帖 ID 需要是正整数。";
export const HELP_MANAGE_RESOLVE = "标记为已解决";
export const HELP_MANAGE_CLOSE = "关闭求助";
export const HELP_MANAGE_PENDING = "处理中…";
export const HELP_MANAGE_LINK_SUCCESS = "已关联活动。";
export const HELP_MANAGE_RESOLVE_SUCCESS = "已标记为已解决。";
export const HELP_MANAGE_CLOSE_SUCCESS = "求助已关闭。";
export const HELP_MANAGE_UNAVAILABLE = "管理操作暂时不可用，可以稍后再试。";
