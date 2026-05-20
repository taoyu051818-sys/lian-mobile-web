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
