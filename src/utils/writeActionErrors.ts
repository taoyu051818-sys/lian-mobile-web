import { LianApiError } from "../api/http";
import { ERROR_RATE_LIMIT } from "../config/brand";

export type WriteActionKind = "publish" | "reply";

interface WriteActionCopy {
  auth: string;
  validation: string;
  network: string;
  rateLimit: string;
  fallback: string;
}

export const WRITE_ACTION_FALLBACK_PUBLISH = "发布暂时没成功，内容已保留，请稍后重试。";
export const WRITE_ACTION_FALLBACK_REPLY = "回复发送失败，内容已保留，请稍后再试。";

const WRITE_ACTION_COPY: Record<WriteActionKind, WriteActionCopy> = {
  publish: {
    auth: "登录状态已失效，内容已保留，请重新登录后再发布。",
    validation: "发布内容还没填完整，内容已保留，请检查后重试。",
    network: "网络有点不稳，内容已保留，请检查连接后重试。",
    rateLimit: "操作太频繁了，内容已保留，请稍后再试。",
    fallback: WRITE_ACTION_FALLBACK_PUBLISH,
  },
  reply: {
    auth: "登录状态已失效，内容已保留，请重新登录后再回复。",
    validation: "回复发送失败，内容已保留，请检查后重试。",
    network: "网络有点不稳，内容已保留，请检查连接后重试。",
    rateLimit: "操作太频繁了，内容已保留，请稍后再试。",
    fallback: WRITE_ACTION_FALLBACK_REPLY,
  },
};

const NETWORK_MESSAGE_PATTERN =
  /(?:failed to fetch|fetch failed|network ?error|network request failed|load failed|timeout)/i;
const SERVICE_MESSAGE_PATTERN =
  /(?:service unavailable|upstream[_ ]error|bad gateway|gateway timeout|internal server error|temporarily unavailable)/i;
const VALIDATION_MESSAGE_PATTERN =
  /(?:required parameters were missing|required parameter|missing required|required field|validation(?: error)?|invalid payload|bad request)/i;
const AUTH_CODE_PATTERN =
  /(?:unauthorized|forbidden|auth(?:_| )?(?:required|invalid|expired)|invalid[_-]?session|session[_-]?expired)/i;
const RATE_LIMIT_CODE_PATTERN = /(?:rate[_-]?limit|too[_-]?many[_-]?requests)/i;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message.trim() : "";
}

function getErrorStatus(error: unknown): number {
  return error instanceof LianApiError ? error.status : 0;
}

function getErrorCode(error: unknown): string {
  return error instanceof LianApiError ? error.code.trim() : "";
}

function looksLikeRawJson(value: string): boolean {
  return /^[\s]*[{[]/.test(value);
}

function isAuthError(error: unknown): boolean {
  const status = getErrorStatus(error);
  const code = getErrorCode(error);
  return status === 401 || status === 403 || AUTH_CODE_PATTERN.test(code);
}

function isRateLimitError(error: unknown): boolean {
  const status = getErrorStatus(error);
  const code = getErrorCode(error);
  const message = getErrorMessage(error);
  return status === 429 || RATE_LIMIT_CODE_PATTERN.test(code) || message === ERROR_RATE_LIMIT;
}

function isNetworkError(error: unknown): boolean {
  const status = getErrorStatus(error);
  const message = getErrorMessage(error);
  return status === 0 && NETWORK_MESSAGE_PATTERN.test(message);
}

function isValidationError(error: unknown): boolean {
  const status = getErrorStatus(error);
  const code = getErrorCode(error);
  const message = getErrorMessage(error);
  return (
    status === 400 ||
    status === 422 ||
    /(?:validation|bad[_-]?request)/i.test(code) ||
    VALIDATION_MESSAGE_PATTERN.test(message)
  );
}

function isServerError(error: unknown): boolean {
  const status = getErrorStatus(error);
  const code = getErrorCode(error);
  const message = getErrorMessage(error);
  return (
    status >= 500 ||
    SERVICE_MESSAGE_PATTERN.test(message) ||
    /(?:upstream|gateway|service[_-]?unavailable|internal[_-]?error)/i.test(code) ||
    looksLikeRawJson(message)
  );
}

export function resolveWriteActionErrorMessage(action: WriteActionKind, error: unknown): string {
  const copy = WRITE_ACTION_COPY[action];

  if (isAuthError(error)) return copy.auth;
  if (isRateLimitError(error)) return copy.rateLimit;
  if (isNetworkError(error)) return copy.network;
  if (isValidationError(error)) return copy.validation;
  if (isServerError(error)) return copy.fallback;

  return copy.fallback;
}

export function isWriteActionGenericFallback(action: WriteActionKind, message: string): boolean {
  return message === WRITE_ACTION_COPY[action].fallback;
}
