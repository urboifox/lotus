import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Label } from "../../components/ui/Label";
import { resetPasswordSchema, type ResetPasswordFormData } from "@/validation";
import { useAuth } from "@/hooks/useAuth";
import { resetPassword } from "@/services/auth";
import { resetPasswordData } from "@/data";

interface LocationState {
  email?: string;
}

function ResetPassword() {
  const location = useLocation();
  // const navigate = useNavigate();
  const locationState = location.state as LocationState | null;
  const emailFromState = locationState?.email;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  // Pre-fill email if coming from forgot password page
  useEffect(() => {
    if (emailFromState) {
      setValue("email", emailFromState);
    }
  }, [emailFromState, setValue]);

  const resetPasswordMutation = useAuth<ResetPasswordFormData, unknown>({
    mutationFn: resetPassword,
  });

  useEffect(() => {
    if (resetPasswordMutation.isSuccess) {
      reset();
    }
  }, [resetPasswordMutation.isSuccess, reset]);

  const onSubmit = (data: ResetPasswordFormData) => {
    resetPasswordMutation.mutate(data);
  };

  if (resetPasswordMutation.isSuccess) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Password Reset Successful!
          </h2>
          <p className="text-gray-600">
            Your password has been reset successfully. You can now log in with
            your new password.
          </p>
        </div>
        <Link
          to="/auth/login"
          className="inline-flex items-center px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
        >
          Go to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Reset Password
        </h1>
        <p className="text-gray-600">
          Enter the OTP code sent to your email and create a new password.
        </p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {resetPasswordMutation.isError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 text-sm">
              {resetPasswordMutation.error instanceof Error
                ? resetPasswordMutation.error.message
                : "Password reset failed. Please try again."}
            </p>
          </div>
        )}
        {resetPasswordData.map(({ name, type, label, placeholder }) => (
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
              maxLength={name === "otp" ? 6 : undefined}
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
          disabled={resetPasswordMutation.isPending}
          className="w-full"
          size="lg"
        >
          {resetPasswordMutation.isPending
            ? "Resetting Password..."
            : "Reset Password"}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-gray-600">
          Didn't receive OTP?{" "}
          <Link
            to="/auth/forgot-password"
            className="text-amber-600 hover:text-amber-700 font-medium"
          >
            Resend Code
          </Link>
        </p>
        <p className="text-gray-600 mt-2">
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

export default ResetPassword;
