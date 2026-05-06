import { useState } from "react";
import {
  CreditCard,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getMyCards, setDefaultCard, deleteCard } from "@/services/cards";
import AddCardModal from "./AddCardModal";
import type { PaymentMethod } from "@/types/payment";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BRAND_LABELS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "Amex",
  discover: "Discover",
  jcb: "JCB",
  diners: "Diners",
  unionpay: "UnionPay",
};

function CardRow({
  card,
  onSetDefault,
  onDelete,
  isDeleting,
  isSettingDefault,
}: {
  card: PaymentMethod;
  onSetDefault: (id: string) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
  isSettingDefault: boolean;
}) {
  const brandLabel = BRAND_LABELS[card.brand?.toLowerCase()] ?? card.brand ?? "Card";
  const expiry = `${String(card.exp_month).padStart(2, "0")}/${String(card.exp_year).slice(-2)}`;

  return (
    <div className="flex items-center gap-4 bg-white/50 rounded-xl p-4">
      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
        <CreditCard className="w-5 h-5 text-secondary" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-poppins font-medium text-secondary">
          {brandLabel} •••• {card.last4}
        </p>
        <p className="text-xs font-poppins text-secondary/60">Expires {expiry}</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {card.is_default ? (
          <span className="flex items-center gap-1 text-xs font-poppins text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">
            <CheckCircle2 className="w-3 h-3" />
            Default
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onSetDefault(card.id)}
            disabled={isSettingDefault || isDeleting}
            className="text-xs font-poppins text-secondary/60 hover:text-secondary underline transition-colors"
            title="Set as default"
          >
            {isSettingDefault ? "Saving..." : "Set default"}
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(card.id)}
          disabled={isDeleting || isSettingDefault}
          aria-label={`Remove ${brandLabel} ending in ${card.last4}`}
          className="text-secondary/40 hover:text-red-600 transition-colors"
          title="Remove card"
        >
          {isDeleting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}

export default function BillingSection() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [actionError, setActionError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PaymentMethod | null>(null);

  const { data: cards = [], isLoading, error, refetch } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: getMyCards,
    retry: 1,
  });

  const defaultMutation = useMutation({
    mutationFn: setDefaultCard,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
      await refetch();
      setActionError("");
    },
    onError: (e: unknown) =>
      setActionError(e instanceof Error ? e.message : "Failed to update default."),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCard,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
      await refetch();
      setPendingDelete(null);
      setActionError("");
    },
    onError: (e: unknown) =>
      setActionError(e instanceof Error ? e.message : "Failed to remove card."),
  });

  const handleDelete = (id: string) => {
    const card = cards.find((item) => item.id === id);
    if (card) setPendingDelete(card);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteMutation.mutate(pendingDelete.id);
  };

  const deleteMessage = (() => {
    const isLastCard = cards.length === 1;
    const label = pendingDelete
      ? `${BRAND_LABELS[pendingDelete.brand?.toLowerCase()] ?? pendingDelete.brand ?? "Card"} ending in ${pendingDelete.last4}`
      : "this card";
    const message = isLastCard
      ? "Your subscription will remain active until the end of the current billing period. To renew automatically, please add a payment method before the renewal date."
      : `Remove ${label}? Your subscription will not be affected.`;
    return message;
  })();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-poppins text-secondary/70">
          Manage your saved payment methods
        </p>
        <Button
          size="sm"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          Add card
        </Button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-secondary/50" />
        </div>
      )}

      {!isLoading && error && (
        <div className="text-center py-4 space-y-2">
          <p className="text-sm text-secondary/60 font-poppins">
            {error instanceof Error && error.message.includes("404")
              ? "No saved cards yet."
              : "Could not load cards."}
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="text-sm font-medium text-secondary underline"
          >
            Try again
          </button>
        </div>
      )}

      {!isLoading && !error && cards.length === 0 && (
        <div className="text-center py-8">
          <CreditCard className="w-10 h-10 text-secondary/30 mx-auto mb-3" />
          <p className="text-sm font-poppins text-secondary/60">No saved cards yet.</p>
          <p className="text-xs font-poppins text-secondary/40 mt-1">
            Add a card to enable automatic renewals.
          </p>
        </div>
      )}

      {cards.map((card) => (
        <CardRow
          key={card.id}
          card={card}
          onSetDefault={(id) => defaultMutation.mutate(id)}
          onDelete={handleDelete}
          isDeleting={deleteMutation.isPending && deleteMutation.variables === card.id}
          isSettingDefault={
            defaultMutation.isPending && defaultMutation.variables === card.id
          }
        />
      ))}

      {actionError && (
        <p className="text-sm text-red-700 font-poppins">{actionError}</p>
      )}

      <AddCardModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          setActionError("");
          void queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
          void refetch();
        }}
      />

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-xl bg-[#F7D8AD] border border-primary shadow-xl p-6 space-y-4">
            <div>
              <h3 className="text-lg font-playfair-display font-bold text-secondary">
                Remove card
              </h3>
              <p className="text-sm font-poppins text-secondary/70 mt-2">
                {deleteMessage}
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPendingDelete(null)}
                disabled={deleteMutation.isPending}
              >
                Keep card
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Remove card
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
