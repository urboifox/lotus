import { z } from "zod";
export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  user_name: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
export const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
export const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});
export const resetPasswordSchema = z
  .object({
    email: z.string().email("Please enter a valid email address"),
    otp: z
      .string()
      .min(6, "OTP must be 6 characters")
      .max(6, "OTP must be 6 characters"),
    new_password: z.string().min(6, "Password must be at least 6 characters"),
    confirm_password: z
      .string()
      .min(6, "Password must be at least 6 characters"),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Passwords don't match",
    path: ["confirm_password"],
  });
export const verifyRegistrationSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  verificationCode: z
    .string()
    .min(6, "Verification code must be 6 characters")
    .max(6, "Verification code must be 6 characters"),
  recaptcha_token: z.string().optional(),
});
export type RegisterFormData = z.infer<typeof registerSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
export type VerifyRegistrationFormData = z.infer<
  typeof verifyRegistrationSchema
>;
