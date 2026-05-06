import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import UpgradeWithSavedCardModal from "@/components/payment/UpgradeWithSavedCardModal";
import { getMyCards } from "@/services/cards";
import {
  useAllPlans,
  useCancelSubscriptionAtPeriodEnd,
  useCurrentPlan,
  useResumeSubscription,
} from "@/services/payment";
import type { CurrentPlan, Plan } from "@/types/payment";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getPeriodEnd(plan: CurrentPlan): Date | null {
  return (
    parseDate(plan.current_period_end) ??
    parseDate(plan.end_date) ??
    parseDate(plan.next_renewal_date)
  );
}

function isFreePlanLabel(value?: string | null): boolean {
  return Boolean(value && /\bfree\b/i.test(value));
}

function hasPaidPlanAccess(plan: CurrentPlan): boolean {
  const periodEnd = getPeriodEnd(plan);
  const status = (plan.subscription_status ?? plan.status ?? "").toLowerCase();
  const hasActiveStatus =
    !status ||
    ACTIVE_SUBSCRIPTION_STATUSES.has(status) ||
    Boolean(plan.cancel_at_period_end);

  return (
    !isFreePlanLabel(plan.plan_description) &&
    !isFreePlanLabel(plan.plan_type) &&
    !isFreePlanLabel(plan.type) &&
    Boolean(periodEnd && periodEnd.getTime() > Date.now()) &&
    hasActiveStatus
  );
}

function findFirstPaidPlan(plansRaw: unknown): Plan | undefined {
  const plans = (plansRaw as Plan[] | undefined) ?? [];
  return [...plans]
    .filter((plan) => !isFreePlanLabel(plan.type) && !isFreePlanLabel(plan.description))
    .sort((a, b) => a.order - b.order)[0];
}

export default function SubscriptionSection() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: planRaw, isLoading, error, refetch } = useCurrentPlan(true);
  const { data: plansRaw, isLoading: plansLoading } = useAllPlans();
  const plan = planRaw as CurrentPlan | undefined;
  const paidPlan = useMemo(() => findFirstPaidPlan(plansRaw), [plansRaw]);

  const [actionMsg, setActionMsg] = useState("");
  const [actionErr, setActionErr] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showSavedCardUpgrade, setShowSavedCardUpgrade] = useState(false);
  const [upgradeStarting, setUpgradeStarting] = useState(false);

  const cancelMutation = useCancelSubscriptionAtPeriodEnd();
  const resumeMutation = useResumeSubscription();

  const isFree = plan ? !hasPaidPlanAccess(plan) : false;

  const {
    data: cards = [],
    isLoading: cardsLoading,
    refetch: refetchCards,
  } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: getMyCards,
    enabled: Boolean(plan && isFree),
    retry: 1,
    staleTime: 1000 * 30,
  });

  const goToCheckout = (planId: string) => {
    navigate(`/payment/checkout?plan_id=${encodeURIComponent(planId)}`);
  };

  const handleUpgrade = async () => {
    setActionMsg("");
    setActionErr("");

    if (!paidPlan) {
      setActionErr("No Pro plan is available right now. Please try again shortly.");
      return;
    }

    setUpgradeStarting(true);
    try {
      const latestCards = cards.length > 0 ? cards : (await refetchCards()).data ?? [];
      if (latestCards.length > 0) {
        setShowSavedCardUpgrade(true);
        return;
      }
      goToCheckout(paidPlan.id);
    } catch {
      goToCheckout(paidPlan.id);
    } finally {
      setUpgradeStarting(false);
    }
  };

  const handleCancel = async () => {
    setActionMsg("");
    setActionErr("");
    cancelMutation.mutate(undefined, {
      onSuccess: async (data) => {
        setActionMsg(data.message);
        setShowCancelConfirm(false);
        await queryClient.invalidateQueries({ queryKey: ["current-plan"] });
        await refetch();
      },
      onError: (e: unknown) =>
        setActionErr(e instanceof Error ? e.message : "Failed to cancel subscription."),
    });
  };

  const handleResume = async () => {
    setActionMsg("");
    setActionErr("");
    resumeMutation.mutate(undefined, {
      onSuccess: async (data) => {
        setActionMsg(data.message);
        await queryClient.invalidateQueries({ queryKey: ["current-plan"] });
        await refetch();
      },
      onError: (e: unknown) =>
        setActionErr(e instanceof Error ? e.message : "Failed to resume subscription."),
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-secondary/50" />
      </div>
    );
  }

  if (!isLoading && error) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-red-700 font-poppins">
          {error instanceof Error ? error.message : "Could not load subscription."}
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="text-sm font-medium text-secondary underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!plan) return null;

  const periodEnd = getPeriodEnd(plan);
  const renewalDate = periodEnd
    ? periodEnd.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "-";

  const upgradeDisabled = plansLoading || cardsLoading || upgradeStarting || !paidPlan;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white/50 rounded-xl p-4">
          <p className="text-xs text-secondary/60 font-poppins mb-1">Current plan</p>
          <p className="text-base font-playfair-display text-secondary font-semibold">
            {isFree ? "Free plan" : plan.plan_description || "-"}
          </p>
        </div>
        <div className="bg-white/50 rounded-xl p-4">
          <p className="text-xs text-secondary/60 font-poppins mb-1">
            {!isFree && plan.cancel_at_period_end ? "Access until" : "Next renewal"}
          </p>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-secondary/60 shrink-0" />
            <p className="text-base font-playfair-display text-secondary font-semibold">
              {renewalDate}
            </p>
          </div>
        </div>
        <div className="bg-white/50 rounded-xl p-4">
          <p className="text-xs text-secondary/60 font-poppins mb-1">Export limit</p>
          <p className="text-base font-playfair-display text-secondary font-semibold">
            {plan.export_limit}
          </p>
        </div>
        <div className="bg-white/50 rounded-xl p-4">
          <p className="text-xs text-secondary/60 font-poppins mb-1">Add new symbols</p>
          <p className="text-base font-playfair-display text-secondary font-semibold">
            {plan.adding_new_symbols ? "Yes" : "No"}
          </p>
        </div>
      </div>

      {isFree && (
        <div className="rounded-xl border border-secondary/15 bg-white/65 p-5 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-700 shrink-0" />
                <h3 className="text-lg font-playfair-display font-bold text-secondary">
                  Upgrade to Lotus Pro
                </h3>
              </div>
              <p className="mt-2 text-sm font-poppins text-secondary/80">
                You are currently on the Free plan.
              </p>
              <p className="mt-1 text-sm font-poppins text-secondary/70">
                You're currently on the Free plan. Upgrade to Pro to save and
                manage more documents.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => void handleUpgrade()}
              disabled={upgradeDisabled}
              className="w-full sm:w-auto shrink-0"
            >
              {upgradeStarting || cardsLoading || plansLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ArrowUpRight className="w-4 h-4 mr-2" />
              )}
              Upgrade to Pro
            </Button>
          </div>
          <ul className="grid gap-2 sm:grid-cols-3 text-xs font-poppins text-secondary/70">
            <li className="rounded-lg bg-primary/20 px-3 py-2">
              Save more documents
            </li>
            <li className="rounded-lg bg-primary/20 px-3 py-2">
              Access Pro features
            </li>
            <li className="rounded-lg bg-primary/20 px-3 py-2">
              Manage billing anytime
            </li>
          </ul>
        </div>
      )}

      {!isFree && plan.cancel_at_period_end && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <XCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-poppins font-medium text-amber-800">
              Cancellation scheduled
            </p>
            <p className="text-xs font-poppins text-amber-700 mt-0.5">
              Your subscription will end on {renewalDate}. You keep full access
              until then.
            </p>
          </div>
        </div>
      )}

      {actionMsg && (
        <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-xl p-3">
          <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
          <p className="text-sm font-poppins text-green-800">{actionMsg}</p>
        </div>
      )}
      {actionErr && (
        <p className="text-sm text-red-700 font-poppins">{actionErr}</p>
      )}

      {isFree && (
        <div className="pt-2 border-t border-primary/20">
          <p className="text-xs font-poppins text-secondary/50 text-center">
            Free plan has no active paid subscription to cancel.
          </p>
        </div>
      )}

      {!isFree && (
        <div className="pt-2 border-t border-primary/20">
          {plan.cancel_at_period_end ? (
            <Button
              variant="outline"
              onClick={handleResume}
              disabled={resumeMutation.isPending}
              className="w-full"
            >
              {resumeMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Resume subscription
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={() => {
                setActionMsg("");
                setActionErr("");
                setShowCancelConfirm(true);
              }}
              disabled={cancelMutation.isPending}
              className="w-full"
            >
              {cancelMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              Cancel subscription
            </Button>
          )}
          <p className="text-xs font-poppins text-secondary/50 text-center mt-2">
            {plan.cancel_at_period_end
              ? "Resuming restores automatic renewal."
              : "You keep full access until the end of the current billing period."}
          </p>
        </div>
      )}

      {paidPlan && (
        <UpgradeWithSavedCardModal
          open={showSavedCardUpgrade}
          onClose={() => setShowSavedCardUpgrade(false)}
          plan={paidPlan}
          onUpgraded={() => {
            setShowSavedCardUpgrade(false);
            void queryClient.invalidateQueries({ queryKey: ["current-plan"] });
            void queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
            void refetch();
          }}
          onUseCheckout={() => {
            setShowSavedCardUpgrade(false);
            goToCheckout(paidPlan.id);
          }}
        />
      )}

      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-xl bg-[#F7D8AD] border border-primary shadow-xl p-6 space-y-4">
            <div>
              <h3 className="text-lg font-playfair-display font-bold text-secondary">
                Cancel subscription
              </h3>
              <p className="text-sm font-poppins text-secondary/70 mt-2">
                Your subscription will stay active until {renewalDate}. Automatic
                renewal will stop at the end of the current billing period.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCancelConfirm(false)}
                disabled={cancelMutation.isPending}
              >
                Keep subscription
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleCancel}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Cancel at period end
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
