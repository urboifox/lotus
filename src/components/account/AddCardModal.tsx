import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import {
  CardCvcElement,
  CardExpiryElement,
  CardNumberElement,
  Elements,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/Button";
import { createSetupIntent, confirmPaymentMethod } from "@/services/cards";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "");

// ── Inner form (needs Stripe context) ────────────────────────────────────────
interface InnerFormProps {
  clientSecret: string;
  onSuccess: () => void;
  onClose: () => void;
}

function InnerForm({ clientSecret, onSuccess, onClose }: InnerFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [makeDefault, setMakeDefault] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError("");

    try {
      const cardNumberElement = elements.getElement(CardNumberElement);
      if (!cardNumberElement) {
        setError("Card form is not ready yet. Please try again.");
        setProcessing(false);
        return;
      }

      const { setupIntent, error: stripeError } = await stripe.confirmCardSetup(
        clientSecret,
        {
          payment_method: {
            card: cardNumberElement,
          },
        },
      );

      if (stripeError) {
        setError(stripeError.message ?? "Card setup failed.");
        setProcessing(false);
        return;
      }

      const pmId =
        typeof setupIntent?.payment_method === "string"
          ? setupIntent.payment_method
          : setupIntent?.payment_method?.id ?? "";

      if (!pmId) {
        setError("Stripe did not return a payment method. Please try again.");
        setProcessing(false);
        return;
      }

      await confirmPaymentMethod(pmId, makeDefault);
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save card.");
    } finally {
      setProcessing(false);
    }
  };

  const elementOptions = {
    style: {
      base: {
        color: "#3d2b1f",
        fontFamily: "Poppins, system-ui, sans-serif",
        fontSize: "16px",
        "::placeholder": {
          color: "#8a796b",
        },
      },
      invalid: {
        color: "#b91c1c",
      },
    },
  };
  const cardNumberOptions = {
    ...elementOptions,
    showIcon: true,
    disableLink: true,
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-poppins font-medium text-secondary/70">
            Card number
          </span>
          <div className="flex min-h-12 items-center rounded-lg border border-primary/40 bg-white px-4 py-3">
            <div className="w-full">
              <CardNumberElement options={cardNumberOptions} />
            </div>
          </div>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-poppins font-medium text-secondary/70">
              Expiry
            </span>
            <div className="flex min-h-12 items-center rounded-lg border border-primary/40 bg-white px-4 py-3">
              <div className="w-full">
                <CardExpiryElement options={elementOptions} />
              </div>
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-poppins font-medium text-secondary/70">
              CVC
            </span>
            <div className="flex min-h-12 items-center rounded-lg border border-primary/40 bg-white px-4 py-3">
              <div className="w-full">
                <CardCvcElement options={elementOptions} />
              </div>
            </div>
          </label>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-poppins text-secondary/80 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={makeDefault}
          onChange={(e) => setMakeDefault(e.target.checked)}
          className="accent-amber-600"
        />
        Set as default payment method
      </label>

      {error && <p className="text-sm text-red-700 font-poppins">{error}</p>}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={processing}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={processing || !stripe || !elements}
          className="flex-1"
        >
          {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save card
        </Button>
      </div>
    </form>
  );
}

// ── Modal wrapper ─────────────────────────────────────────────────────────────
interface AddCardModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddCardModal({ open, onClose, onSuccess }: AddCardModalProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setClientSecret(null);
      setError("");
      return;
    }
    setLoading(true);
    createSetupIntent()
      .then((res) => setClientSecret(res.client_secret))
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to initialise card form."),
      )
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="relative bg-[#F7D8AD] rounded-2xl border border-primary shadow-xl w-full max-w-md p-7">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-playfair-display font-bold text-secondary">
            Add a new card
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-secondary/50 hover:text-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-7 h-7 animate-spin text-secondary/60" />
          </div>
        )}

        {error && (
          <p className="text-sm text-red-700 font-poppins text-center py-6">{error}</p>
        )}

        {clientSecret && (
          <Elements
            stripe={stripePromise}
            options={{
              appearance: {
                theme: "stripe",
                variables: {
                  colorText: "#3d2b1f",
                  fontFamily: "Poppins, system-ui, sans-serif",
                },
              },
            }}
          >
            <InnerForm
              clientSecret={clientSecret}
              onSuccess={() => {
                setClientSecret(null);
                onSuccess();
                onClose();
              }}
              onClose={onClose}
            />
          </Elements>
        )}

        <p className="text-xs text-secondary/50 font-poppins text-center mt-4">
          Secured by Stripe. Your card details are never stored on our servers.
        </p>
      </div>
    </div>
  );
}
