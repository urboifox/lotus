import { apiClient } from "@/config/axios.config";
import { notifyAuthChanged } from "@/utils/authSession";
import type {
  LoginFormData,
  RegisterFormData,
  ForgotPasswordFormData,
  ResetPasswordFormData,
  VerifyRegistrationFormData,
} from "@/validation";

export const registerUser = async (dataa: RegisterFormData) => {
  const { data } = await apiClient.post("/account", dataa);
  return data;
};

export const loginUser = async (dataa: LoginFormData) => {
  // Convert to URL-encoded format as required by the backend
  const formData = new URLSearchParams();
  formData.append("username", dataa.username);
  formData.append("password", dataa.password);
  const { data } = await apiClient.post("/login", formData, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  // Save the entire response object to localStorage, injecting username as email
  // so that the export-usage counter (which keys on email) works for all login types.
  localStorage.setItem(
    "user",
    JSON.stringify({ ...data, email: data.email ?? dataa.username })
  );

  // Also save token separately for the axios interceptor
  if (data.access_token) {
    localStorage.setItem("token", data.access_token);
  }
  notifyAuthChanged();

  return data;
};

export const sendOtp = async (dataa: ForgotPasswordFormData) => {
  const { data } = await apiClient.post("/send-code", {
    email: dataa.email,
    recaptcha_token: "",
  });
  return data;
};

export const resetPassword = async (dataa: ResetPasswordFormData) => {
  const { data } = await apiClient.put("/reset-password", {
    email: dataa.email,
    verificationCode: dataa.otp,
    new_password: dataa.new_password,
    confirm_password: dataa.confirm_password,
  });
  return data;
};

export const verifyRegistration = async (dataa: VerifyRegistrationFormData) => {
  const { data } = await apiClient.post("/verify-registration", {
    ...dataa,
    recaptcha_token: dataa.recaptcha_token || "",
  });
  return data;
};

export const deleteAccount = async () => {
  const { data } = await apiClient.delete("/account/delete");
  return data;
};

// Social Login - These redirect to OAuth providers
export const loginWithGoogle = () => {
  const origin = encodeURIComponent(window.location.origin);
  window.location.href = `${import.meta.env.VITE_API_URL}/auth/google/start?redirect_url=${origin}`;
};

export const loginWithMicrosoft = () => {
  const origin = encodeURIComponent(window.location.origin);
  window.location.href = `${import.meta.env.VITE_API_URL}/auth/microsoft/start?redirect_url=${origin}`;
};
