import { apiGet, apiSend } from "./http";
import type { ProfileUser } from "../types/profile";

export type AuthMode = "login" | "register";
export type AuthInterestAvailability = "loading" | "ready" | "empty" | "unavailable";

export const AUTH_ONBOARDING_INTEREST_LIMIT = 5;

export interface LoginPayload {
  login: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email?: string;
  emailCode?: string;
  password: string;
  inviteCode?: string;
  interests?: string[];
}

export interface AuthInterestOption {
  id: string;
  label: string;
  description: string;
}

export interface AuthRulesResponse {
  institutions?: Array<{ name: string; tags: string[]; domains: string[] }>;
  interests?: AuthInterestOption[];
}

export interface AuthInterestSelectionState {
  availability: AuthInterestAvailability;
  options: AuthInterestOption[];
  canSkip: boolean;
  helperText: string;
}

export interface AuthResponse {
  user?: ProfileUser | null;
}

export interface EmailCodeResponse {
  institution?: string;
}

export async function fetchAuthRules(): Promise<AuthRulesResponse> {
  return apiGet<AuthRulesResponse>("/api/auth/rules");
}

export function createLoadingAuthInterestSelectionState(): AuthInterestSelectionState {
  return {
    availability: "loading",
    options: [],
    canSkip: true,
    helperText: "兴趣偏好正在加载中，稍后也可以再设置。",
  };
}

export function createUnavailableAuthInterestSelectionState(): AuthInterestSelectionState {
  return {
    availability: "unavailable",
    options: [],
    canSkip: true,
    helperText: "兴趣偏好暂时没有加载成功，你可以先完成注册，稍后再设置推荐偏好。",
  };
}

export function createAuthInterestSelectionState(rules?: AuthRulesResponse | null): AuthInterestSelectionState {
  const options = (rules?.interests || []).filter((interest): interest is AuthInterestOption => {
    return Boolean(interest?.id && interest.label);
  });

  if (!options.length) {
    return {
      availability: "empty",
      options: [],
      canSkip: true,
      helperText: "当前没有可选兴趣，先完成注册，稍后再设置推荐偏好。",
    };
  }

  return {
    availability: "ready",
    options,
    canSkip: true,
    helperText: `最多选择 ${AUTH_ONBOARDING_INTEREST_LIMIT} 个兴趣，用于初始化首页推荐。可稍后再设置。`,
  };
}

export async function loadAuthInterestSelectionState(
  loadRules: () => Promise<AuthRulesResponse> = fetchAuthRules,
): Promise<AuthInterestSelectionState> {
  try {
    const rules = await loadRules();
    return createAuthInterestSelectionState(rules);
  } catch {
    return createUnavailableAuthInterestSelectionState();
  }
}

export function toggleAuthInterestSelection(
  current: string[],
  id: string,
  limit = AUTH_ONBOARDING_INTEREST_LIMIT,
): string[] {
  if (current.includes(id)) {
    return current.filter((item) => item !== id);
  }
  if (current.length >= limit) {
    return current;
  }
  return [...current, id];
}

export async function loginAuth(payload: LoginPayload): Promise<ProfileUser | null> {
  const data = await apiSend<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.user || null;
}

export async function registerAuth(payload: RegisterPayload): Promise<ProfileUser | null> {
  const data = await apiSend<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.user || null;
}

export async function sendEmailCode(email: string): Promise<EmailCodeResponse> {
  return apiSend<EmailCodeResponse>("/api/auth/email-code", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}
