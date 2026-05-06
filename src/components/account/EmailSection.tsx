import { useState } from "react";
import { Mail, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { requestEmailChange, verifyEmailChange } from "@/services/profile";
import PasswordSection from "@/components/account/PasswordSection";

interface EmailSectionProps {
  currentEmail: string;
  onUpdated: () => void;
}

type Step = "idle" | "requesting" | "verifying" | "done";

export default function EmailSection({ currentEmail, onUpdated }: EmailSectionProps) {
  const [step, setStep] = useState<Step>("idle");
  const [newEmail, setNewEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRequest = async () => {
    const normalizedEmail = newEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Please enter a new email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await requestEmailChange(normalizedEmail);
      setStep("verifying");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to send code.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    const normalizedCode = code.trim();
    if (!normalizedCode) {
      setError("Please enter the 6-digit code.");
      return;
    }
    if (!/^\d{6}$/.test(normalizedCode)) {
      setError("Verification code must be 6 digits.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await verifyEmailChange(normalizedCode);
      setStep("done");
      onUpdated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Invalid or expired code.");
    } finally {
      setLoading(false);
    }
  };

  if (step === "done") {
    return (
      <div className="space-y-8">
        <div className="flex flex-col items-center gap-4 py-6">
          <CheckCircle2 className="w-12 h-12 text-green-600" />
          <p className="text-lg font-playfair-display text-secondary font-semibold">
            Email updated successfully!
          </p>
          <p className="text-sm text-secondary/70 font-poppins text-center">
            Your account email is now{" "}
            <span className="font-medium text-secondary">{newEmail}</span>. Please
            log in again with your new email.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setStep("idle");
              setNewEmail("");
              setCode("");
            }}
          >
            Change again
          </Button>
        </div>
        <hr className="border-primary/30" />
        <PasswordSection />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Current email (display) */}
      <div className="space-y-1">
        <label className="text-sm font-poppins text-secondary/70">Current email</label>
        <div className="flex items-center gap-3 bg-white/40 rounded-lg px-3 py-2 border border-primary/30">
          <Mail className="w-4 h-4 text-secondary/50 shrink-0" />
          <span className="text-sm font-poppins text-secondary">{currentEmail}</span>
        </div>
      </div>

      {step === "idle" && (
        <>
          <div className="space-y-1">
            <label className="text-sm font-poppins text-secondary/70">New email address</label>
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="you@example.com"
              onKeyDown={(e) => e.key === "Enter" && handleRequest()}
            />
          </div>

          {error && <p className="text-sm text-red-700 font-poppins">{error}</p>}

          <Button onClick={handleRequest} disabled={loading} className="w-full">
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4 mr-2" />
            )}
            Send verification code
          </Button>
          <p className="text-xs text-secondary/50 font-poppins text-center">
            A 6-digit code will be sent to your new email address.
            <br />
            OAuth users (Google) must update their email via their provider.
          </p>
        </>
      )}

      {step === "verifying" && (
        <>
          <p className="text-sm font-poppins text-secondary/80">
            A 6-digit code has been sent to{" "}
            <span className="font-medium text-secondary">{newEmail}</span>. Enter
            it below to confirm the change.
          </p>

          <div className="space-y-1">
            <label className="text-sm font-poppins text-secondary/70">Verification code</label>
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              onKeyDown={(e) => e.key === "Enter" && handleVerify()}
            />
          </div>

          {error && <p className="text-sm text-red-700 font-poppins">{error}</p>}

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setStep("idle");
                setCode("");
                setError("");
              }}
              disabled={loading}
              className="flex-1"
            >
              Back
            </Button>
            <Button onClick={handleVerify} disabled={loading} className="flex-1">
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Confirm
            </Button>
          </div>
          <p className="text-xs text-secondary/50 font-poppins text-center">
            Code expires in 15 minutes.{" "}
            <button
              type="button"
              onClick={() => {
                setStep("idle");
                setCode("");
                setError("");
              }}
              className="underline"
            >
              Resend
            </button>
          </p>
        </>
      )}

      <hr className="border-primary/30" />
      <PasswordSection />
    </div>
  );
}
