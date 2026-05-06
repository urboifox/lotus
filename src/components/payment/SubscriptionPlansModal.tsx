import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Check, ImageIcon, Loader2, Zap } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { useAllPlans } from "@/services/payment";
import { getMyCards } from "@/services/cards";
import UpgradeWithSavedCardModal from "@/components/payment/UpgradeWithSavedCardModal";
import type { Plan } from "@/types/payment";

interface SubscriptionPlansModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason?: "export-limit" | "save-limit";
}

export function SubscriptionPlansModal({
  open,
  onOpenChange,
  reason = "export-limit",
}: SubscriptionPlansModalProps) {
  const { data: plansRaw, isLoading: plansLoading } = useAllPlans();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const plans = useMemo(() => {
    const list = (plansRaw as Plan[] | undefined) ?? [];
    return [...list]
      .filter((p) => p.type !== "Free")
      .sort((a, b) => a.order - b.order);
  }, [plansRaw]);
  const firstPaidPlan = plans[0];
  const [savedCardModalOpen, setSavedCardModalOpen] = useState(false);

  // Only fetch saved cards while the save-limit dialog is open. We use this to
  // decide whether to show the in-app saved-card modal or fall back to Stripe
  // Checkout for users who have no saved cards yet.
  const cardsQuery = useQuery({
    queryKey: ["payment-methods"],
    queryFn: getMyCards,
    enabled: open && reason === "save-limit",
    retry: 1,
    staleTime: 1000 * 30,
  });

  const goToCheckout = (planId: string) => {
    onOpenChange(false);
    navigate(`/payment/checkout?plan_id=${encodeURIComponent(planId)}`);
  };

  const handleSaveLimitUpgradeClick = () => {
    if (!firstPaidPlan) return;
    const cards = cardsQuery.data ?? [];
    if (cards.length > 0) {
      setSavedCardModalOpen(true);
      return;
    }
    // No saved cards — keep the existing Stripe Checkout flow (Add Card lives
    // on the saved-card modal too, but users who hit save-limit on a
    // brand-new account shouldn't be forced through it before paying).
    goToCheckout(firstPaidPlan.id);
  };

  if (reason === "save-limit") {
    return (
      <>
        <Dialog
          open={open && !savedCardModalOpen}
          onOpenChange={(v) => {
            if (!v) setSavedCardModalOpen(false);
            onOpenChange(v);
          }}
        >
          <DialogContent className="w-full max-w-md p-6 border-0 shadow-2xl">
            <DialogClose onClick={() => onOpenChange(false)} />
            <DialogHeader>
              <DialogTitle>
                <span className="text-2xl tracking-tight">Upgrade to Lotus Pro</span>
              </DialogTitle>
              <DialogDescription>
                <span className="block text-gray-600 mt-3 text-sm leading-relaxed">
                  You&apos;re currently on the Free plan. Free users can save
                  only one file. Upgrade to Lotus Pro to save and manage
                  unlimited documents.
                </span>
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-5 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-white hover:border-gray-300 transition-colors font-poppins"
              >
                Not now
              </button>
              <button
                type="button"
                disabled={
                  plansLoading || !firstPaidPlan || cardsQuery.isLoading
                }
                className="px-5 py-2 rounded-xl bg-gradient-to-br from-[#ccaa83] to-[#b8956a] text-white text-sm font-semibold shadow-md shadow-[#ccaa83]/25 hover:shadow-lg hover:shadow-[#ccaa83]/30 hover:brightness-[1.03] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 font-poppins inline-flex items-center justify-center gap-2"
                onClick={handleSaveLimitUpgradeClick}
              >
                {cardsQuery.isLoading && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                Upgrade to Pro
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {firstPaidPlan && (
          <UpgradeWithSavedCardModal
            open={savedCardModalOpen}
            onClose={() => setSavedCardModalOpen(false)}
            plan={firstPaidPlan}
            onUpgraded={() => {
              setSavedCardModalOpen(false);
              onOpenChange(false);
              void queryClient.invalidateQueries({ queryKey: ["current-plan"] });
            }}
            onUseCheckout={() => {
              setSavedCardModalOpen(false);
              goToCheckout(firstPaidPlan.id);
            }}
          />
        )}
      </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className=" w-full max-h-[82vh] flex flex-col min-h-0 overflow-hidden relative p-0 gap-0 border-0 shadow-2xl">
        <DialogClose onClick={() => onOpenChange(false)} />
        <div className="shrink-0 bg-gradient-to-b from-[#faf8f5] to-white rounded-t-lg px-5 sm:px-10 lg:px-12 pt-5 pb-1">
          <DialogHeader>
            <div className="text-center max-w-2xl mx-auto -mt-1">
              <DialogTitle>
                <span className="text-2xl sm:text-3xl tracking-tight">
                  Upgrade your plan
                </span>
              </DialogTitle>
              <DialogDescription>
                <span className="block text-gray-600 mt-2 text-[0.9375rem] leading-relaxed">
                  You have reached your export limit for the current plan.
                  Choose a plan and continue exporting with a subscription.
                </span>
              </DialogDescription>
            </div>
          </DialogHeader>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain px-5 sm:px-10 lg:px-12 pb-4">
          {plansLoading && (
            <p className="text-sm text-gray-600 font-poppins py-6 text-center">
              Loading plans…
            </p>
          )}
          {!plansLoading && plans.length === 0 && (
            <p className="text-sm text-gray-600 font-poppins py-6 text-center">
              No paid plans are available right now. Please try again later.
            </p>
          )}

          {plans.length > 0 && (
            <div className="flex min-h-0 items-stretch justify-center py-2">
              <div className="w-full grid gap-4 sm:gap-5 lg:gap-6 grid-cols-1 auto-rows-fr">
                {plans.map((plan) => (
                  <article
                    key={plan.id}
                    className="group relative flex flex-col text-left rounded-2xl border border-gray-200/90 bg-white p-5 sm:p-6 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.08)] transition-all duration-300 hover:border-[#ccaa83]/45 hover:shadow-[0_20px_40px_-12px_rgba(204,170,131,0.25)] hover:-translate-y-1 min-w-0"
                  >
                    <div
                      className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-[#ccaa83]/0 via-[#ccaa83] to-[#ccaa83]/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      aria-hidden
                    />

                    <div className="font-playfair-display font-semibold text-gray-900 text-lg sm:text-xl leading-snug pr-2">
                      {plan.description}
                    </div>

                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-semibold text-gray-900 tracking-tight font-playfair-display">
                        {plan.price_in_usd > 0
                          ? `$${plan.price_in_usd.toFixed(2)}`
                          : "—"}
                      </span>
                      {
                        <span className="text-sm text-gray-500 font-poppins font-medium">
                          USD
                        </span>
                      }
                    </div>

                    <ul className="mt-4 space-y-2.5 flex-1 font-poppins text-sm text-gray-600">
                      <li className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#ccaa83]/12 text-[#8a7048]">
                          <Zap className="h-3 w-3" strokeWidth={2.5} />
                        </span>
                        <span>
                          <strong className="font-semibold text-gray-800">
                            {plan.export_limit}
                          </strong>{" "}
                          exports per period
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#ccaa83]/12 text-[#8a7048]">
                          <ImageIcon className="h-3 w-3" strokeWidth={2.5} />
                        </span>
                        <span>
                          {plan.watermark
                            ? "Exports include watermark"
                            : "No watermark on exports"}
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700">
                          <Check className="h-3 w-3" strokeWidth={2.5} />
                        </span>
                        <span>
                          {plan.adding_new_symbols
                            ? "Add new symbols"
                            : "Symbol set as per plan"}
                        </span>
                      </li>
                    </ul>

                    <button
                      type="button"
                      className="mt-6 cursor-pointer w-full rounded-xl bg-gradient-to-br from-[#ccaa83] to-[#b8956a] text-white text-base font-semibold px-6 py-3 shadow-md shadow-[#ccaa83]/25 hover:shadow-lg hover:shadow-[#ccaa83]/30 hover:brightness-[1.03] active:scale-[0.98] transition-all duration-200 font-poppins"
                      onClick={() => {
                        onOpenChange(false);
                        navigate(
                          `/payment/checkout?plan_id=${encodeURIComponent(
                            plan.id,
                          )}`,
                        );
                      }}
                    >
                      Subscribe
                    </button>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-gray-100 bg-gray-50/80 rounded-b-lg px-5 sm:px-10 lg:px-12 py-3 flex justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-5 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-white hover:border-gray-300 transition-colors font-poppins"
          >
            Not now
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
