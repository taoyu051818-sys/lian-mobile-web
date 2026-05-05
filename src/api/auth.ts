import { apiSend } from "./http";
import type { ProfileUser } from "../types/profile";

export type AuthMode = "login" | "register";

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
}

export interface AuthResponse {
  user?: ProfileUser | null;
}

export interface EmailCodeResponse {
  institution?: string;
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
