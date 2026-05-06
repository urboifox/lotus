import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Label } from "../../components/ui/Label";
import {
  forgotPasswordSchema,
  type ForgotPasswordFormData,
} from "@/validation";
import { useAuth } from "@/hooks/useAuth";
import { sendOtp } from "@/services/auth";
import { forgotPasswordData } from "@/data";

function ForgotPassword() {
  const [emailSent, setEmailSent] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const sendOtpMutation = useAuth<ForgotPasswordFormData, unknown>({
    mutationFn: sendOtp,
    onSuccess: () => {
      setEmailSent(true);
    },
  });

  const onSubmit = (data: ForgotPasswordFormData) => {
    sendOtpMutation.mutate(data);
  };

  const handleContinueToReset = () => {
    const email = getValues("email");
    navigate("/auth/reset-password", { state: { email } });
  };

  if (emailSent) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Check Your Email
          </h2>
          <p className="text-gray-600 mb-4">
            We've sent a 6-digit OTP code to your email address.
          </p>
          <p className="text-sm text-gray-500">
            Please check your inbox and enter the code on the next page.
          </p>
        </div>
        <Button
          onClick={handleContinueToReset}
          className="w-full mb-4"
          size="lg"
        >
          Continue to Reset Password
        </Button>
        <button
          onClick={() => setEmailSent(false)}
          className="text-amber-600 hover:text-amber-700 font-medium text-sm"
        >
          Resend OTP
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Forgot Password
        </h1>
        <p className="text-gray-600">
          Enter your email address and we'll send you an OTP code to reset your
          password.
        </p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {sendOtpMutation.isError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 text-sm">
              {sendOtpMutation.error instanceof Error
                ? sendOtpMutation.error.message
                : "Failed to send OTP. Please try again."}
            </p>
          </div>
        )}
        {forgotPasswordData.map(({ name, type, label, placeholder }) => (
          <div key={name}>
            <Label htmlFor={name} required>
              {label}
            </Label>
            <Input
              {...register(name)}
              type={type}
              id={name}
              placeholder={placeholder}
              error={!!errors[name]}
            />
            {errors[name] && (
              <p className="mt-1 text-sm text-red-600">
                {errors[name]?.message}
              </p>
            )}
          </div>
        ))}
        <Button
          type="submit"
          disabled={sendOtpMutation.isPending}
          className="w-full"
          size="lg"
        >
          {sendOtpMutation.isPending ? "Sending OTP..." : "Send OTP"}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-gray-600">
          Remember your password?{" "}
          <Link
            to="/auth/login"
            className="text-amber-600 hover:text-amber-700 font-medium"
          >
            Back to Login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default ForgotPassword;
