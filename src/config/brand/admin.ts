/** 管理后台 */
export const ADMIN_SECTION_LABEL = "管理后台";
export const ADMIN_ENTER_LABEL = "管理";
export const ADMIN_EXIT_LABEL = "退出管理";
export const ADMIN_BACK_TO_PROFILE = "返回我的";

/** Token 闸门 */
export const ADMIN_TOKEN_GATE_TITLE = "管理员令牌";
export const ADMIN_TOKEN_GATE_HINT = "粘贴运维方提供的 ADMIN_TOKEN，进入审核台。";
export const ADMIN_TOKEN_PLACEHOLDER = "ADMIN_TOKEN";
export const ADMIN_TOKEN_SUBMIT = "进入";
export const ADMIN_TOKEN_INVALID = "令牌无效，请重新粘贴。";
export const ADMIN_TOKEN_REQUIRED = "请填入令牌再继续。";
export const ADMIN_TOKEN_CLEARED = "令牌已清除。";

/** Tab */
export const ADMIN_TAB_REPORTS = "举报队列";
export const ADMIN_TAB_AUDIT = "审计日志";
export const ADMIN_TAB_LABEL = "管理后台标签";

/** 队列 */
export const ADMIN_QUEUE_EMPTY = "暂无举报。";
export const ADMIN_QUEUE_EMPTY_TITLE = "举报队列暂时是空的";
export const ADMIN_QUEUE_EMPTY_BODY =
  "还没有新的举报进入这台审核台。后续同学提交的举报会先落到这里，也可以手动刷新再看一次。";
export const ADMIN_QUEUE_LOADING = "加载举报队列…";
export const ADMIN_QUEUE_RELOAD = "重新加载";
export const ADMIN_QUEUE_LOAD_ERROR = "队列加载失败，可以稍后再试。";
export const ADMIN_QUEUE_FILTER_ALL = "全部";
export const ADMIN_QUEUE_FILTER_PENDING = "待处理";
export const ADMIN_QUEUE_FILTER_REVIEWING = "审核中";
export const ADMIN_QUEUE_FILTER_RESOLVED = "已处理";
export const ADMIN_QUEUE_FILTER_DISMISSED = "已驳回";

/** 状态徽章 */
export const ADMIN_STATUS_PENDING = "待处理";
export const ADMIN_STATUS_REVIEWING = "审核中";
export const ADMIN_STATUS_RESOLVED = "已处理";
export const ADMIN_STATUS_DISMISSED = "已驳回";
export const ADMIN_STATUS_FALLBACK = "其他";

/** 单条举报 */
export const ADMIN_REPORT_REPORTER_LABEL = "举报人";
export const ADMIN_REPORT_TARGET_LABEL = "对象";
export const ADMIN_REPORT_REASON_LABEL = "原因";
export const ADMIN_REPORT_TIME_LABEL = "时间";
export const ADMIN_REPORT_NOTE_LABEL = "管理员备注";
export const ADMIN_REPORT_NOTE_PLACEHOLDER = "可填写处理理由（选填）。";
export const ADMIN_REPORT_EXPAND = "展开操作";
export const ADMIN_REPORT_COLLAPSE = "收起";

/** 操作面板 */
export const ADMIN_ACTION_TITLE = "处置";
export const ADMIN_ACTION_TRANSITION_LABEL = "变更状态";
export const ADMIN_ACTION_TRANSITION_SUBMIT = "确认变更";
export const ADMIN_ACTION_POST_HIDE = "隐藏帖子";
export const ADMIN_ACTION_POST_LOCK = "锁定回复";
export const ADMIN_ACTION_POST_UNLOCK = "取消锁定";
export const ADMIN_ACTION_USER_TITLE = "处置用户";
export const ADMIN_ACTION_USER_STATUS_LABEL = "用户状态";
export const ADMIN_ACTION_USER_REASON_LABEL = "状态原因";
export const ADMIN_ACTION_USER_REASON_PLACEHOLDER = "可填写说明（选填）。";
export const ADMIN_ACTION_USER_SUBMIT = "应用用户状态";
export const ADMIN_ACTION_USER_TARGET_LABEL = "目标用户 ID 或邮箱";

/** 用户状态选项 */
export const ADMIN_USER_STATUS_ACTIVE = "正常";
export const ADMIN_USER_STATUS_LIMITED = "限号";
export const ADMIN_USER_STATUS_BANNED = "封号";

/** 反馈 */
export const ADMIN_ACTION_OK = "操作已生效。";
export const ADMIN_ACTION_FAIL = "操作没有成功，可以稍后再试。";

/** 审计日志 */
export const ADMIN_AUDIT_EMPTY = "暂无审计日志。";
export const ADMIN_AUDIT_EMPTY_TITLE = "还没有审核动作记录";
export const ADMIN_AUDIT_EMPTY_BODY =
  "当管理员处理举报、帖子或用户状态后，这里会按时间留下记录。现在空白通常表示这一轮还没有动作写入。";
export const ADMIN_AUDIT_LOAD_ERROR = "审计日志加载失败，可以稍后再试。";
export const ADMIN_AUDIT_ACTION_LABEL = "操作";
export const ADMIN_AUDIT_ACTOR_LABEL = "操作人";
export const ADMIN_AUDIT_TARGET_LABEL = "对象";
export const ADMIN_AUDIT_TIME_LABEL = "时间";
