import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Download, Loader2 } from "lucide-react";
import HelmetTitle from "@/components/HelmetTitle";
import {
  downloadPaymentReceiptPdf,
  getStripeCheckoutResult,
  getPaymentReceipts,
  pickLatestReceiptId,
} from "@/services/payment";

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const token = localStorage.getItem("token");

  const queryClient = useQueryClient();
  const didRenewRef = useRef(false);

  const confirmCheckout = useMutation({
    mutationFn: () => getStripeCheckoutResult(sessionId),
  });

  const {
    data: receipts,
    refetch: refetchReceipts,
    isPending: receiptsPending,
    isError: receiptsError,
    isSuccess: receiptsSuccess,
  } = useQuery({
    queryKey: ["payment-receipts"],
    queryFn: () => getPaymentReceipts(),
    enabled: Boolean(token),
    retry: false,
    staleTime: 1000 * 10,
  });

  const receiptId = useMemo(
    () => pickLatestReceiptId(receipts ?? []),
    [receipts],
  );

  const downloadPdf = useMutation({
    mutationFn: (id: string) => downloadPaymentReceiptPdf(id),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        blob.type === "application/pdf"
          ? "payment-receipt.pdf"
          : `payment-receipt-${Date.now()}.bin`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
  });

  useEffect(() => {
    if (!token) return;
    const t1 = window.setTimeout(() => void refetchReceipts(), 2500);
    const t2 = window.setTimeout(() => void refetchReceipts(), 8000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [refetchReceipts, token]);

  useEffect(() => {
    if (!token) return;
    if (!sessionId) return;
        if (didRenewRef.current) return;
    didRenewRef.current = true;

    (async () => {
      try {
        await confirmCheckout.mutateAsync();
      } catch (e) {
        console.error("[payment] checkout confirmation failed:", e);
      } finally {
        queryClient.invalidateQueries({ queryKey: ["current-plan"] });
        void refetchReceipts();
        window.setTimeout(
          () => queryClient.invalidateQueries({ queryKey: ["current-plan"] }),
          2500,
        );
        window.setTimeout(() => void refetchReceipts(), 3000);
      }
    })();
  }, [confirmCheckout, queryClient, refetchReceipts, sessionId, token]);

  const receiptLoading = Boolean(token) && receiptsPending;

  const receiptHint = receiptsError
    ? "We couldn't load your receipt yet. Try again in a moment."
    : receiptLoading
      ? "Loading your receipt…"
      : receiptsSuccess && !receiptId
        ? "Your receipt is being prepared. This page will update in a few seconds."
        : receiptId
          ? "Your bill is ready to download."
          : null;

  return (
    <div className="min-h-screen flex flex-col bg-[#fbf2e6] text-[#121212]">
      <HelmetTitle title="Payment Successful" description="Subscription" />

      <main className="flex-grow flex items-center justify-center px-4 py-14 sm:py-16 md:py-20 mt-10">
        <div className="w-full max-w-4xl rounded-2xl border border-[#d8a865]/25 bg-white shadow-[0_25px_60px_-15px_rgba(90,70,40,0.18)] overflow-hidden ring-1 ring-black/[0.03]">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-0">
            {/* Success */}
            <div className="md:col-span-7 relative px-8 py-12 sm:px-10 sm:py-14 md:p-14 lg:p-16 bg-gradient-to-br from-[#fefbf6] via-white to-[#fef8f0] overflow-hidden">
              <div
                className="pointer-events-none absolute -top-28 -left-28 h-72 w-72 rounded-full bg-[#d8a865]/12 blur-3xl"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute -bottom-20 -right-16 h-56 w-56 rounded-full bg-[#d8a865]/10 blur-3xl"
                aria-hidden
              />

              <div className="relative z-10">
                <div className="mb-8 inline-flex h-[5.25rem] w-[5.25rem] items-center justify-center rounded-full bg-[#d8a865]/14 ring-2 ring-[#d8a865]/25 ring-offset-4 ring-offset-[#fefbf6]">
                  <CheckCircle2
                    className="h-11 w-11 text-[#8a6a3e]"
                    strokeWidth={1.75}
                  />
                </div>

                <p className="font-poppins text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-[#8a7048] mb-3">
                  All set
                </p>
                <h1 className="font-playfair-display text-4xl sm:text-5xl md:text-[3.25rem] leading-[1.1] text-[#121212] mb-6">
                  Payment{" "}
                  <span className="italic text-[#b8894a]">Confirmed</span>
                </h1>
                <p className="font-poppins text-base text-[#514f4a] max-w-md leading-relaxed mb-10">
                  Your transaction has been securely processed. We&apos;ve sent
                  a detailed confirmation to your registered email.
                </p>

                <Link
                  to="/writing"
                  className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#d8a865] to-[#c4944f] px-8 py-3.5 font-poppins text-[0.9375rem] font-semibold text-white shadow-lg shadow-[#d8a865]/30 transition hover:brightness-[1.03] active:scale-[0.99]"
                >
                  Return to Writing
                </Link>
              </div>
            </div>

            {/* Receipt */}
            <div className="md:col-span-5 border-t md:border-t-0 md:border-l border-[#d8a865]/20 bg-gradient-to-b from-[#faf8f5] to-[#f5f0e8] px-8 py-10 sm:px-10 md:py-14 flex flex-col justify-center min-h-[260px]">
              <div className="w-full max-w-sm mx-auto md:mx-0 md:max-w-none">
                <p className="font-poppins text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-[#8a7048] mb-2">
                  Invoice
                </p>
                <h2 className="font-playfair-display text-2xl text-[#121212] mb-5">
                  Your receipt
                </h2>

                <div className="rounded-xl border border-[#d8a865]/20 bg-white/80 px-4 py-4 mb-6 backdrop-blur-sm">
                  <div className="flex items-start gap-3">
                    {receiptLoading ? (
                      <Loader2
                        className="h-5 w-5 shrink-0 text-[#b8894a] animate-spin mt-0.5"
                        aria-hidden
                      />
                    ) : (
                      <div
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#2d8a54]"
                        aria-hidden
                      />
                    )}
                    <p className="font-poppins text-sm text-[#514f4a] leading-relaxed">
                      {receiptHint ??
                        "When your receipt is ready, you can download it here."}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  {receiptId ? (
                    <button
                      type="button"
                      disabled={downloadPdf.isPending}
                      onClick={() => downloadPdf.mutate(receiptId)}
                      className="cursor-pointer inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#ccaa83] to-[#b8956a] px-6 py-3.5 font-poppins text-[0.9375rem] font-semibold text-white shadow-md shadow-[#ccaa83]/25 transition hover:brightness-[1.03] active:scale-[0.99] disabled:opacity-55 disabled:pointer-events-none"
                    >
                      {downloadPdf.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" strokeWidth={2.25} />
                      )}
                      {downloadPdf.isPending ? "Downloading…" : "Download bill"}
                    </button>
                  ) : null}

                  {receiptsError || (receiptsSuccess && !receiptId) ? (
                    <button
                      type="button"
                      className="font-poppins text-sm font-medium text-[#b8894a] underline-offset-2 hover:underline text-left"
                      onClick={() => void refetchReceipts()}
                    >
                      Refresh receipt
                    </button>
                  ) : null}

                  {downloadPdf.isError ? (
                    <p className="font-poppins text-sm text-red-700">
                      Download failed. Please try again.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
