import { useState } from "react";
import { KeyRound, Loader2, ArrowRight, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  requestPasswordChangeCode,
  changePasswordWithCode,
} from "@/services/profile";

type Step = "idle" | "verifying" | "done";

const PASSWORD_MIN = 6;

function extractError(e: unknown, fallback: string): string {
  if (typeof e === "object" && e !== null) {
    const anyE = e as {
      response?: { data?: { detail?: string | { msg?: string }[] } };
      message?: string;
    };
    const detail = anyE.response?.data?.detail;
    if (typeof detail === "string") {
      return humanizeBackendCode(detail) || detail;
    }
    if (Array.isArray(detail) && detail[0]?.msg) {
      return detail[0].msg!;
    }
    if (anyE.message) return anyE.message;
  }
  return fallback;
}

function humanizeBackendCode(code: string): string {
  switch (code) {
    case "password_is_managed_by_oauth_provider_change_from_google_or_contact_support":
      return "Your account is managed by Google. Please change your password from your Google account.";
    case "no_pending_password_change_request_found":
      return "No pending password change. Please request a new code.";
    case "invalid_password_change_verification_code":
      return "The verification code is incorrect.";
    case "password_change_verification_code_has_expired":
      return "The verification code has expired. Please request a new one.";
    case "password_does_not_meet_minimum_requirements":
      return `Password must be at least ${PASSWORD_MIN} characters.`;
    case "passwords_dont_match":
      return "New password and confirmation do not match.";
    case "new_password_cannot_be_the_same_as_the_current_password":
      return "New password cannot be the same as your current password.";
    case "failed_to_send_email":
      return "Failed to send the verification email. Please try again.";
    default:
      return "";
  }
}

export default function PasswordSection() {
  const [step, setStep] = useState<Step>("idle");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const resetAll = () => {
    setStep("idle");
    setCode("");
    setNewPassword("");
    setConfirmPassword("");
    setShowNew(false);
    setShowConfirm(false);
    setError("");
    setInfo("");
  };

  const handleRequestCode = async () => {
    setLoading(true);
    setError("");
    setInfo("");
    try {
      await requestPasswordChangeCode();
      setStep("verifying");
      setInfo("A 6-digit code was sent to your email.");
    } catch (e: unknown) {
      setError(extractError(e, "Failed to send verification code."));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    const trimmedCode = code.trim();
    if (!/^\d{6}$/.test(trimmedCode)) {
      setError("Verification code must be 6 digits.");
      return;
    }
    if (newPassword.length < PASSWORD_MIN) {
      setError(`Password must be at least ${PASSWORD_MIN} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setLoading(true);
    setError("");
    setInfo("");
    try {
      await changePasswordWithCode({
        code: trimmedCode,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setStep("done");
    } catch (e: unknown) {
      setError(extractError(e, "Failed to change password."));
    } finally {
      setLoading(false);
    }
  };

  if (step === "done") {
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <CheckCircle2 className="w-12 h-12 text-green-600" />
        <p className="text-lg font-playfair-display text-secondary font-semibold">
          Password updated successfully!
        </p>
        <p className="text-sm text-secondary/70 font-poppins text-center">
          Use your new password the next time you log in.
        </p>
        <Button variant="outline" onClick={resetAll}>
          Change again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-secondary/60" />
        <h3 className="text-base font-playfair-display font-semibold text-secondary">
          Change password
        </h3>
      </div>

      {step === "idle" && (
        <>
          <p className="text-sm text-secondary/70 font-poppins">
            We&apos;ll email a 6-digit verification code to your account email.
            Enter the code together with your new password to confirm the change.
          </p>

          {error && <p className="text-sm text-red-700 font-poppins">{error}</p>}
          {info && <p className="text-sm text-secondary/80 font-poppins">{info}</p>}

          <Button onClick={handleRequestCode} disabled={loading} className="w-full">
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4 mr-2" />
            )}
            Send verification code
          </Button>
          <p className="text-xs text-secondary/50 font-poppins text-center">
            If your account is managed by Google, change your password from your
            Google account.
          </p>
        </>
      )}

      {step === "verifying" && (
        <>
          {info && <p className="text-sm text-secondary/80 font-poppins">{info}</p>}

          <div className="space-y-1">
            <label className="text-sm font-poppins text-secondary/70">
              Verification code
            </label>
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              autoComplete="one-time-code"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-poppins text-secondary/70">
              New password
            </label>
            <div className="relative">
              <Input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={`At least ${PASSWORD_MIN} characters`}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNew((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary/60 hover:text-secondary"
                aria-label={showNew ? "Hide password" : "Show password"}
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-poppins text-secondary/70">
              Confirm new password
            </label>
            <div className="relative">
              <Input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                autoComplete="new-password"
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary/60 hover:text-secondary"
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-700 font-poppins">{error}</p>}

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={resetAll}
              disabled={loading}
              className="flex-1"
            >
              Back
            </Button>
            <Button onClick={handleSubmit} disabled={loading} className="flex-1">
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Update password
            </Button>
          </div>

          <p className="text-xs text-secondary/50 font-poppins text-center">
            Code expires in 15 minutes.{" "}
            <button
              type="button"
              onClick={handleRequestCode}
              className="underline"
              disabled={loading}
            >
              Resend code
            </button>
          </p>
        </>
      )}
    </div>
  );
}
