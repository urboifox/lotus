import { apiClient } from "@/config/axios.config";
import type { UserProfile } from "@/types/profile";

/** GET /me — full user profile */
export async function getProfile(): Promise<UserProfile> {
  const { data } = await apiClient.get<UserProfile>("/me");
  return data;
}

/** PUT /me/edit-profile — update name (and optionally other fields) */
export async function updateProfile(payload: {
  name?: string;
  user_name?: string;
  country_id?: number;
}): Promise<{ message: string }> {
  const { data } = await apiClient.put<{ message: string }>("/me/edit-profile", payload);
  return data;
}

export interface AvatarUploadResponse {
  message: string;
  avatar_url: string;
  profile: UserProfile;
}

/** POST /me/avatar — upload avatar file */
export async function uploadAvatar(file: File): Promise<AvatarUploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<AvatarUploadResponse>("/me/avatar", form);
  return data;
}

/** POST /me/email/request-change — send 6-digit code to new email */
export async function requestEmailChange(newEmail: string): Promise<{ message: string }> {
  const { data } = await apiClient.post<{ message: string }>("/me/email/request-change", {
    new_email: newEmail,
  });
  return data;
}

/** POST /me/email/verify-change — confirm with code */
export async function verifyEmailChange(code: string): Promise<{ message: string }> {
  const { data } = await apiClient.post<{ message: string }>("/me/email/verify-change", { code });
  return data;
}

/** POST /me/password/request-change-code — email a 6-digit code to current user */
export async function requestPasswordChangeCode(): Promise<{ message: string }> {
  const { data } = await apiClient.post<{ message: string }>(
    "/me/password/request-change-code",
    {},
  );
  return data;
}

/** POST /me/password/change — verify code and set new password */
export async function changePasswordWithCode(payload: {
  code: string;
  new_password: string;
  confirm_password: string;
}): Promise<{ message: string }> {
  const { data } = await apiClient.post<{ message: string }>(
    "/me/password/change",
    payload,
  );
  return data;
}
