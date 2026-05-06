import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CreditCard, Loader2, Plus, X } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { Button } from "@/components/ui/Button";
import {
  confirmSavedCardPayment,
  getMyCards,
  subscribeWithSavedCard,
} from "@/services/cards";
import AddCardModal from "@/components/account/AddCardModal";
import type {
  PaymentMethod,
  Plan,
  SubscriptionDuration,
} from "@/types/payment";

const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "",
);

const BRAND_LABELS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "Amex",
  discover: "Discover",
  jcb: "JCB",
  diners: "Diners",
  unionpay: "UnionPay",
};

interface UpgradeWithSavedCardModalProps {
  open: boolean;
  onClose: () => void;
  plan: Plan;
  /** Called after a successful upgrade so the parent can refresh CurrentPlan etc. */
  onUpgraded: () => void;
  /** Allow falling back to Stripe Checkout (used when user has no saved cards). */
  onUseCheckout?: () => void;
}

export default function UpgradeWithSavedCardModal({
  open,
  onClose,
  plan,
  onUpgraded,
  onUseCheckout,
}: UpgradeWithSavedCardModalProps) {
  const queryClient = useQueryClient();

  const {
    data: cards = [],
    isLoading: cardsLoading,
    refetch: refetchCards,
  } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: getMyCards,
    enabled: open,
    retry: 1,
  });

  const defaultCardId = useMemo(
    () => cards.find((c) => c.is_default)?.id ?? cards[0]?.id ?? null,
    [cards],
  );

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [duration, setDuration] = useState<SubscriptionDuration>("MONTHLY");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showAddCard, setShowAddCard] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectedCardId(null);
      setSubmitting(false);
      setError("");
      setSuccess("");
      setShowAddCard(false);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (selectedCardId) return;
    if (defaultCardId) setSelectedCardId(defaultCardId);
  }, [open, defaultCardId, selectedCardId]);

  const computedAmount = useMemo(() => {
    const base = Number(plan.price_in_usd ?? plan.price ?? 0);
    if (!Number.isFinite(base) || base <= 0) return 0;
    return duration === "ANNUAL" ? base * 12 : base;
  }, [plan.price_in_usd, plan.price, duration]);

  const handleConfirm = async () => {
    if (!selectedCardId) {
      setError("Please choose a card to pay with.");
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const res = await subscribeWithSavedCard({
        plan_id: plan.id,
        payment_method_id: selectedCardId,
        subscription_duration: duration,
        set_as_default: false,
      });

      if (res.status === "succeeded" || res.status === "free") {
        setSuccess(
          res.status === "free"
            ? "Coupon applied — you're all set."
            : "Payment confirmed. Welcome to Lotus Pro!",
        );
        await queryClient.invalidateQueries({ queryKey: ["current-plan"] });
        await queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
        await queryClient.invalidateQueries({ queryKey: ["payment-receipts"] });
        // Give the success state a moment so it's visible before closing.
        setTimeout(() => {
          onUpgraded();
          onClose();
        }, 700);
        return;
      }

      if (res.status === "requires_action" && res.client_secret && res.payment_intent_id) {
        const stripe = await stripePromise;
        if (!stripe) {
          setError("Could not load Stripe to complete authentication.");
          setSubmitting(false);
          return;
        }
        const { error: confirmError, paymentIntent } =
          await stripe.confirmCardPayment(res.client_secret);

        if (confirmError) {
          setError(confirmError.message ?? "Card authentication failed.");
          setSubmitting(false);
          return;
        }

        if (paymentIntent?.status !== "succeeded") {
          setError(
            `Payment did not complete (status: ${paymentIntent?.status ?? "unknown"}).`,
          );
          setSubmitting(false);
          return;
        }

        const finalised = await confirmSavedCardPayment({
          plan_id: plan.id,
          payment_method_id: selectedCardId,
          payment_intent_id: res.payment_intent_id,
          subscription_duration: duration,
        });

        if (finalised.status === "succeeded") {
          setSuccess("Payment confirmed. Welcome to Lotus Pro!");
          await queryClient.invalidateQueries({ queryKey: ["current-plan"] });
          await queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
          await queryClient.invalidateQueries({ queryKey: ["payment-receipts"] });
          setTimeout(() => {
            onUpgraded();
            onClose();
          }, 700);
          return;
        }

        setError(finalised.message || "Could not finalize the subscription.");
        setSubmitting(false);
        return;
      }

      setError(res.message || "Payment did not complete.");
      setSubmitting(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Payment failed. Please try again.");
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const noCards = !cardsLoading && cards.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-primary bg-[#F7D8AD] shadow-xl p-7">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-xl font-playfair-display font-bold text-secondary">
              Upgrade to {plan.description ?? plan.type}
            </h2>
            <p className="text-sm font-poppins text-secondary/70 mt-1">
              Pay with one of your saved cards — no need to re-enter card
              details.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-secondary/50 hover:text-secondary transition-colors disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <button
            type="button"
            onClick={() => setDuration("MONTHLY")}
            disabled={submitting}
            className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
              duration === "MONTHLY"
                ? "border-secondary bg-white"
                : "border-primary/30 bg-white/50 hover:bg-white"
            }`}
          >
            <div className="text-xs font-poppins uppercase tracking-wide text-secondary/60">
              Monthly
            </div>
            <div className="font-playfair-display font-semibold text-secondary">
              ${(plan.price_in_usd ?? plan.price).toFixed(2)} USD
              <span className="text-xs font-poppins text-secondary/60"> /mo</span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setDuration("ANNUAL")}
            disabled={submitting}
            className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
              duration === "ANNUAL"
                ? "border-secondary bg-white"
                : "border-primary/30 bg-white/50 hover:bg-white"
            }`}
          >
            <div className="text-xs font-poppins uppercase tracking-wide text-secondary/60">
              Annual
            </div>
            <div className="font-playfair-display font-semibold text-secondary">
              ${((plan.price_in_usd ?? plan.price) * 12).toFixed(2)} USD
              <span className="text-xs font-poppins text-secondary/60"> /yr</span>
            </div>
          </button>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-poppins font-medium text-secondary/70 uppercase tracking-wide">
              Pay with
            </span>
            <button
              type="button"
              onClick={() => setShowAddCard(true)}
              disabled={submitting}
              className="text-xs font-poppins font-medium text-secondary hover:underline inline-flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Add card
            </button>
          </div>

          {cardsLoading && (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-secondary/50" />
            </div>
          )}

          {noCards && (
            <div className="rounded-xl bg-white/60 border border-primary/30 p-4 text-sm font-poppins text-secondary/80 text-center">
              You don&apos;t have a saved card yet. Add a card to upgrade
              instantly{onUseCheckout ? ", or continue via Stripe Checkout." : "."}
              <div className="mt-3 flex flex-wrap gap-2 justify-center">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setShowAddCard(true)}
                  className="inline-flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add card
                </Button>
                {onUseCheckout && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onUseCheckout}
                  >
                    Use Stripe Checkout
                  </Button>
                )}
              </div>
            </div>
          )}

          {!cardsLoading && cards.length > 0 && (
            <ul className="space-y-2">
              {cards.map((card: PaymentMethod) => {
                const brand =
                  BRAND_LABELS[card.brand?.toLowerCase()] ?? card.brand ?? "Card";
                const expiry = `${String(card.exp_month).padStart(2, "0")}/${String(
                  card.exp_year,
                ).slice(-2)}`;
                const selected = card.id === selectedCardId;
                return (
                  <li key={card.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedCardId(card.id)}
                      disabled={submitting}
                      className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                        selected
                          ? "border-secondary bg-white shadow-sm"
                          : "border-primary/30 bg-white/50 hover:bg-white"
                      }`}
                    >
                      <span className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <CreditCard className="w-4 h-4 text-secondary" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-poppins font-medium text-secondary">
                          {brand} •••• {card.last4}
                          {card.is_default && (
                            <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-700 bg-amber-100 rounded-full px-1.5 py-0.5 font-poppins">
                              Default
                            </span>
                          )}
                        </span>
                        <span className="block text-xs font-poppins text-secondary/60">
                          Expires {expiry}
                        </span>
                      </span>
                      {selected && (
                        <CheckCircle2 className="w-5 h-5 text-secondary shrink-0" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-xl bg-white/70 border border-primary/30 px-4 py-3 mb-4 flex items-center justify-between">
          <span className="text-sm font-poppins text-secondary/80">
            Total charged today
          </span>
          <span className="font-playfair-display font-semibold text-secondary text-lg">
            ${computedAmount.toFixed(2)} USD
          </span>
        </div>

        {error && (
          <p className="text-sm text-red-700 font-poppins mb-3">{error}</p>
        )}
        {success && (
          <p className="text-sm text-emerald-700 font-poppins mb-3">{success}</p>
        )}

        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || cards.length === 0 || !selectedCardId}
          >
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {submitting ? "Processing…" : "Confirm upgrade"}
          </Button>
        </div>

        <p className="text-xs text-secondary/50 font-poppins text-center mt-4">
          Payments processed securely by Stripe. Your card details are never
          stored on our servers.
        </p>

        <AddCardModal
          open={showAddCard}
          onClose={() => setShowAddCard(false)}
          onSuccess={() => {
            setShowAddCard(false);
            void queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
            void refetchCards();
          }}
        />
      </div>
    </div>
  );
}
