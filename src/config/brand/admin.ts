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
/** issue #725 — 解释「为什么是空的」，而不是只说「暂无」。 */
export const ADMIN_QUEUE_EMPTY_HINT =
  "队列保持空白说明当前没有待处置的举报。新举报会在用户提交后立刻进入这里，不需要刷新。";
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
/** issue #725 — 解释这里会被什么填满，作为复核依据。 */
export const ADMIN_AUDIT_EMPTY_HINT =
  "处置举报或调整用户状态后会自动写入这里，可在事后回放并对照「举报队列」做复核。";
export const ADMIN_AUDIT_LOAD_ERROR = "审计日志加载失败，可以稍后再试。";
export const ADMIN_AUDIT_ACTION_LABEL = "操作";
export const ADMIN_AUDIT_ACTOR_LABEL = "操作人";
export const ADMIN_AUDIT_TARGET_LABEL = "对象";
export const ADMIN_AUDIT_TIME_LABEL = "时间";
export const ADMIN_AUDIT_REFRESH = "刷新日志";

/** 头部头像首字（identity chrome） */
export const ADMIN_AVATAR_TEXT = "管";

/** Token 闸门补充文案 */
export const ADMIN_PROBE_LOADING = "正在确认管理员会话…";
export const ADMIN_SESSION_FALLBACK = "管理员会话不可用，可改用 ADMIN_TOKEN 进入。";
export const ADMIN_SESSION_PROBE_FAIL = "管理员会话探测失败，可改用 ADMIN_TOKEN 进入。";

/** 认证审核 tab */
export const ADMIN_VERIFICATION_TAB_LABEL = "认证审核";
export const ADMIN_VERIFICATION_FILTER_GROUP_LABEL = "认证审核状态筛选";
export const ADMIN_VERIFICATION_LIST_LOADING = "加载认证审核队列…";
export const ADMIN_VERIFICATION_LOAD_ERROR = "认证审核队列加载失败，可以稍后再试。";

/** 认证审核空态（issue #725 — 解释队列在什么情况下保持空白） */
export const ADMIN_VERIFICATION_EMPTY_PENDING_TITLE = "现在没有待审核申请";
export const ADMIN_VERIFICATION_EMPTY_PENDING_BODY =
  "新的商户、跑腿员、实名或组织成员申请进入队列后，会先显示在这里。";
export const ADMIN_VERIFICATION_EMPTY_APPROVED_TITLE = "还没有已通过记录";
export const ADMIN_VERIFICATION_EMPTY_APPROVED_BODY =
  "审核通过后的申请会归档到这里，方便回看最近放行的身份结果。";
export const ADMIN_VERIFICATION_EMPTY_REJECTED_TITLE = "还没有已拒绝记录";
export const ADMIN_VERIFICATION_EMPTY_REJECTED_BODY =
  "需要补材料或暂不符合条件的申请被拒绝后，会在这里留下处理结果。";
export const ADMIN_VERIFICATION_EMPTY_ALL_TITLE = "当前还没有认证申请";
export const ADMIN_VERIFICATION_EMPTY_ALL_BODY =
  "当用户开始提交实名、商户、跑腿员或组织成员申请后，这里会形成审核队列。";

/** 认证审核状态选项 */
export const ADMIN_VERIFICATION_STATUS_ALL = "全部";
export const ADMIN_VERIFICATION_STATUS_PENDING = "待审核";
export const ADMIN_VERIFICATION_STATUS_APPROVED = "已通过";
export const ADMIN_VERIFICATION_STATUS_REJECTED = "已拒绝";

/** 认证申请类型 */
export const ADMIN_VERIFICATION_TYPE_ORG_JOIN = "组织成员";
export const ADMIN_VERIFICATION_TYPE_REALNAME = "实名认证";
export const ADMIN_VERIFICATION_TYPE_MERCHANT = "商户认证";
export const ADMIN_VERIFICATION_TYPE_RUNNER = "跑腿员";

/** 认证审核字段标签 */
export const ADMIN_VERIFICATION_USER_ID_LABEL = "用户 ID";
export const ADMIN_VERIFICATION_SUBMITTED_AT_LABEL = "提交时间";
export const ADMIN_VERIFICATION_REVIEWER_LABEL = "审核人";
export const ADMIN_VERIFICATION_REVIEWED_AT_LABEL = "处理时间";

/** 摘要行标签（不同申请类型共用） */
export const ADMIN_VERIFICATION_SUMMARY_ORG_NAME = "组织";
export const ADMIN_VERIFICATION_SUMMARY_ORG_ID = "组织 ID";
export const ADMIN_VERIFICATION_SUMMARY_NOTE = "备注";
export const ADMIN_VERIFICATION_SUMMARY_ID_TYPE = "证件类型";
export const ADMIN_VERIFICATION_SUMMARY_REAL_NAME = "姓名";
export const ADMIN_VERIFICATION_SUMMARY_ID_NUMBER = "证件号";
export const ADMIN_VERIFICATION_SUMMARY_CONTACT = "联系方式";
export const ADMIN_VERIFICATION_SUMMARY_MERCHANT_NAME = "商户名称";

/** 实名脱敏与查看 */
export const ADMIN_VERIFICATION_REALNAME_MASKED_HINT =
  "默认列表只展示脱敏摘要；实名认证敏感字段仅在显式查看时通过后端审计路径读取。";
export const ADMIN_VERIFICATION_REVEAL_PENDING = "读取中…";
export const ADMIN_VERIFICATION_REVEAL_AGAIN = "重新读取实名明细";
export const ADMIN_VERIFICATION_REVEAL_FIRST = "查看实名明细";

/** 审核备注与决策 */
export const ADMIN_VERIFICATION_REVIEWER_NOTE_PREFIX = "审核备注：";
export const ADMIN_VERIFICATION_REVIEWER_NOTE_LABEL = "审核备注";
export const ADMIN_VERIFICATION_REVIEWER_NOTE_PLACEHOLDER = "可填写通过或拒绝理由（选填）。";
export const ADMIN_VERIFICATION_DECISION_APPROVE = "通过";
export const ADMIN_VERIFICATION_DECISION_REJECT = "拒绝";

/** Auth-link 管理 tab */
export const ADMIN_AUTH_LINK_TAB_LABEL = "邀请链接";
export const ADMIN_AUTH_LINK_LIST_LOADING = "加载邀请链接…";
export const ADMIN_AUTH_LINK_LOAD_ERROR = "邀请链接加载失败，可以稍后再试。";

/** Auth-link 空态 */
export const ADMIN_AUTH_LINK_EMPTY_TITLE = "还没有邀请链接";
export const ADMIN_AUTH_LINK_EMPTY_BODY =
  "创建邀请链接后可以分享给新用户，他们点击链接即可获得指定的身份或权限。";

/** Auth-link 状态 */
export const ADMIN_AUTH_LINK_STATUS_ACTIVE = "有效";
export const ADMIN_AUTH_LINK_STATUS_EXPIRED = "已过期";
export const ADMIN_AUTH_LINK_STATUS_EXHAUSTED = "已用完";

/** Auth-link 字段标签 */
export const ADMIN_AUTH_LINK_TOKEN_LABEL = "链接标识";
export const ADMIN_AUTH_LINK_CREATED_AT_LABEL = "创建时间";
export const ADMIN_AUTH_LINK_EXPIRES_AT_LABEL = "过期时间";
export const ADMIN_AUTH_LINK_USAGE_LABEL = "使用次数";
export const ADMIN_AUTH_LINK_AUDIENCE_LABEL = "受众标签";
export const ADMIN_AUTH_LINK_GRANT_LABEL = "授予权限";

/** Auth-link 操作 */
export const ADMIN_AUTH_LINK_CREATE = "创建链接";
export const ADMIN_AUTH_LINK_COPY_URL = "复制链接";
export const ADMIN_AUTH_LINK_COPY_SUCCESS = "链接已复制到剪贴板";
export const ADMIN_AUTH_LINK_REVOKE = "撤销";
export const ADMIN_AUTH_LINK_REVOKE_CONFIRM = "确定要撤销这个邀请链接吗？撤销后无法恢复。";
export const ADMIN_AUTH_LINK_PREVIEW_CARD = "预览分享卡";

/** Auth-link 创建表单 */
export const ADMIN_AUTH_LINK_FORM_TITLE = "创建邀请链接";
export const ADMIN_AUTH_LINK_FORM_AUDIENCE_LABEL = "受众标签";
export const ADMIN_AUTH_LINK_FORM_AUDIENCE_PLACEHOLDER = "例如：2026 级新生";
export const ADMIN_AUTH_LINK_FORM_MAX_USES_LABEL = "最大使用次数";
export const ADMIN_AUTH_LINK_FORM_TTL_LABEL = "有效期";
export const ADMIN_AUTH_LINK_FORM_TTL_1H = "1 小时";
export const ADMIN_AUTH_LINK_FORM_TTL_24H = "24 小时";
export const ADMIN_AUTH_LINK_FORM_TTL_7D = "7 天";
export const ADMIN_AUTH_LINK_FORM_TTL_30D = "30 天";
export const ADMIN_AUTH_LINK_FORM_GRANT_ROLE_LABEL = "授予角色";
export const ADMIN_AUTH_LINK_FORM_GRANT_ROLE_NONE = "不授予角色";
export const ADMIN_AUTH_LINK_FORM_GRANT_VERIFICATION_LABEL = "授予认证";
export const ADMIN_AUTH_LINK_FORM_GRANT_VERIFICATION_NONE = "不授予认证";
export const ADMIN_AUTH_LINK_FORM_SUBMIT = "创建";
export const ADMIN_AUTH_LINK_FORM_CANCEL = "取消";

/** Auth-link grant 类型 */
export const ADMIN_AUTH_LINK_GRANT_CAMPUS_VERIFIED = "校园认证";
export const ADMIN_AUTH_LINK_GRANT_ORG_MEMBER = "组织成员";
export const ADMIN_AUTH_LINK_GRANT_REALNAME_VERIFIED = "实名认证";
export const ADMIN_AUTH_LINK_GRANT_MERCHANT_VERIFIED = "商户认证";
export const ADMIN_AUTH_LINK_GRANT_RUNNER = "跑腿员";
