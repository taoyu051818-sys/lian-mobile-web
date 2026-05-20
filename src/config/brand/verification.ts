/** 认证中心 */
export const VERIFICATION_SECTION_LABEL = "认证中心";
export const VERIFICATION_ENTER_LABEL = "认证中心";
export const VERIFICATION_BACK_TO_PROFILE = "返回我的";

/** 认证类别名称 */
export const VERIFICATION_TAG_CAMPUS = "高校认证";
export const VERIFICATION_TAG_ORG = "组织成员";
export const VERIFICATION_TAG_REALNAME = "实名认证";
export const VERIFICATION_TAG_MERCHANT = "商户认证";
export const VERIFICATION_TAG_RUNNER = "跑腿员";

/** 认证状态 */
export const VERIFICATION_STATUS_ACTIVE = "已认证";
export const VERIFICATION_STATUS_INACTIVE = "未认证";
export const VERIFICATION_STATUS_EXPIRED = "已过期";
export const VERIFICATION_STATUS_REVOKED = "已撤销";

/** 字段标签 */
export const VERIFICATION_GRANTED_AT_LABEL = "认证时间";
export const VERIFICATION_EXPIRES_AT_LABEL = "有效期至";
export const VERIFICATION_SOURCE_LABEL = "认证来源";
export const VERIFICATION_NO_GRANT_HINT =
  "当前还没有这项认证记录。开放申请或审核完成后，这里会显示对应状态与时间。";
export const VERIFICATION_EMPTY_TITLE = "还没有生效中的认证";
export const VERIFICATION_EMPTY_BODY =
  "先从下方校园邮箱认证开始。通过后的校园、商户、跑腿员或组织成员结果都会回到上面的列表。";

/** 校园邮箱写入流程 */
export const VERIFICATION_CAMPUS_TITLE = "校园邮箱认证";
export const VERIFICATION_CAMPUS_HINT = "用你的高校邮箱接收一次性验证码，完成校园身份绑定。";
export const VERIFICATION_CAMPUS_EMAIL_LABEL = "高校邮箱";
export const VERIFICATION_CAMPUS_EMAIL_PLACEHOLDER = "name@your-school.edu.cn";
export const VERIFICATION_CAMPUS_CODE_LABEL = "邮箱验证码";
export const VERIFICATION_CAMPUS_CODE_PLACEHOLDER = "6 位验证码";
export const VERIFICATION_CAMPUS_SUBMIT = "完成认证";
export const VERIFICATION_CAMPUS_SUBMITTING = "认证中…";
export const VERIFICATION_CAMPUS_SUCCESS = "校园邮箱认证已完成。";
export const VERIFICATION_CAMPUS_SEND_BUTTON = "发送验证码";
export const VERIFICATION_CAMPUS_SEND_PENDING = "发送中";
export const VERIFICATION_CAMPUS_RESEND = "重发";
export const VERIFICATION_CAMPUS_CODE_SENT = "验证码已发送，识别为 {n}。";
export const VERIFICATION_CAMPUS_EMAIL_REQUIRED = "请先填写高校邮箱。";
export const VERIFICATION_CAMPUS_CODE_REQUIRED = "请填入收到的验证码。";
export const VERIFICATION_CAMPUS_LOAD_ERROR = "认证状态加载失败，可以稍后再试。";
export const VERIFICATION_CAMPUS_SEND_FAIL = "验证码发送失败，可以稍后再试。";
export const VERIFICATION_CAMPUS_CONFIRM_FAIL = "认证未完成，可以重新发送验证码再试。";

/** 其它认证占位 */
export const VERIFICATION_OTHER_PLACEHOLDER =
  "商户、跑腿员、组织成员等申请入口会按开放进度补到这里；现在可以先完成校园邮箱认证，后续结果也会统一回到本页。";