import { apiSend } from "./http";
import type { CampusEmailConfirmResponse, CampusEmailSendResponse } from "../types/verification";

export async function sendCampusEmailCode(email: string): Promise<CampusEmailSendResponse> {
  return apiSend<CampusEmailSendResponse>("/api/auth/verify/campus-email/send", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function confirmCampusEmailCode(
  email: string,
  code: string,
): Promise<CampusEmailConfirmResponse> {
  return apiSend<CampusEmailConfirmResponse>("/api/auth/verify/campus-email/confirm", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
}
