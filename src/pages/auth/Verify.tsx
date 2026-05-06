import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Label } from "../../components/ui/Label";
import {
  verifyRegistrationSchema,
  type VerifyRegistrationFormData,
} from "@/validation";
import { useAuth } from "@/hooks/useAuth";
import { verifyRegistration } from "@/services/auth";
import { verifyRegistrationData } from "@/data";

interface LocationState {
  email?: string;
}

function Verify() {
  const location = useLocation();
  const locationState = location.state as LocationState | null;
  const emailFromState = locationState?.email;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<VerifyRegistrationFormData>({
    resolver: zodResolver(verifyRegistrationSchema),
  });

  // Pre-fill email if coming from register page
  useEffect(() => {
    if (emailFromState) {
      setValue("email", emailFromState);
    }
  }, [emailFromState, setValue]);

  const verifyMutation = useAuth<VerifyRegistrationFormData, unknown>({
    mutationFn: verifyRegistration,
  });

  useEffect(() => {
    if (verifyMutation.isSuccess) {
      reset();
    }
  }, [verifyMutation.isSuccess, reset]);

  const onSubmit = (data: VerifyRegistrationFormData) => {
    verifyMutation.mutate(data);
  };

  if (verifyMutation.isSuccess) {
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
            Email Verified Successfully!
          </h2>
          <p className="text-gray-600">
            Your account has been verified. You can now log in to your account.
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
          Verify Your Email
        </h1>
        <p className="text-gray-600">
          Enter the verification code sent to your email address.
        </p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {verifyMutation.isError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 text-sm">
              {verifyMutation.error instanceof Error
                ? verifyMutation.error.message
                : "Verification failed. Please try again."}
            </p>
          </div>
        )}
        {verifyRegistrationData.map(({ name, type, label, placeholder }) => (
          <div key={name}>
            <Label htmlFor={name} required>
              {label}
            </Label>
            <Input
              {...register(name)}
              disabled={name === "email" && !!emailFromState ? true : false}
              type={type}
              id={name}
              placeholder={placeholder}
              error={!!errors[name]}
              maxLength={name === "verificationCode" ? 6 : undefined}
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
          disabled={verifyMutation.isPending}
          className="w-full"
          size="lg"
        >
          {verifyMutation.isPending ? "Verifying..." : "Verify Email"}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-gray-600">
          Didn't receive the code?{" "}
          <Link
            to="/auth/register"
            className="text-amber-600 hover:text-amber-700 font-medium"
          >
            Register Again
          </Link>
        </p>
        <p className="text-gray-600 mt-2">
          Already verified?{" "}
          <Link
            to="/auth/login"
            className="text-amber-600 hover:text-amber-700 font-medium"
          >
            Go to Login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Verify;
