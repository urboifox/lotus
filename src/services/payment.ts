import { isAxiosError } from "axios";
import { apiClient } from "@/config/axios.config";
import useCustomQuery from "@/config/useCustomQuery";
import { useMutation } from "@tanstack/react-query";
import type {
  CreateCheckoutPayload,
  CurrentPlan,
  PaymentReceipt,
  Plan,
  SubscriptionHistoryItem,
} from "@/types/payment";

function is404(e: unknown): boolean {
  return isAxiosError(e) && e.response?.status === 404;
}

export async function fetchAllPlans(): Promise<Plan[]> {
  const { data } = await apiClient.get<Plan[]>("/plan/All");
  return data;
}

export async function fetchPlanById(planId: string): Promise<Plan> {
  const plans = await fetchAllPlans();
  const plan = plans.find((item) => item.id === planId);

  if (!plan) {
    throw new Error("Selected plan is not available.");
  }

  return plan;
}

export async function getCurrentPlan(): Promise<CurrentPlan> {
  const { data } = await apiClient.get<CurrentPlan>("/CurrentPlan");
  return data;
}

export async function getSubscriptionHistory(): Promise<
  SubscriptionHistoryItem[]
> {
  const { data } = await apiClient.get<SubscriptionHistoryItem[]>(
    "/SubscriptionHistory",
  );
  return data;
}

export async function cancelSubscription(): Promise<{ message: string }> {
  // OpenAPI: POST /Cancel (capital C). Some deployments also expose /cancel.
  try {
    const { data } = await apiClient.post<{ message: string }>("/Cancel");
    return data;
  } catch (e) {
    if (is404(e) || (isAxiosError(e) && e.response?.status === 405)) {
      const { data } = await apiClient.post<{ message: string }>("/cancel");
      return data;
    }
    throw e;
  }
}

/** POST /payment-stripe/subscription/cancel — cancel at period end (keeps access) */
export async function cancelSubscriptionAtPeriodEnd(): Promise<{ message: string }> {
  const { data } = await apiClient.post<{ message: string }>(
    "/payment-stripe/subscription/cancel",
  );
  return data;
}

/** POST /payment-stripe/subscription/resume — un-schedule a pending cancellation */
export async function resumeSubscription(): Promise<{ message: string }> {
  const { data } = await apiClient.post<{ message: string }>(
    "/payment-stripe/subscription/resume",
  );
  return data;
}

export async function createCheckoutSession(
  payload: CreateCheckoutPayload,
): Promise<unknown> {
  const body = {
    ...payload,
    // Many APIs expect `gateway`; docs sometimes say `getaway` — send both.
    gateway: payload.getaway,
  };
  try {
    const { data } = await apiClient.post<unknown>(
      "/payment-stripe/create-checkout",
      body,
    );
    return data;
  } catch (e) {
    if (is404(e)) {
      const { data } = await apiClient.post<unknown>(
        "/payment-stripe/create-checkout/",
        body,
      );
      return data;
    }
    throw e;
  }
}

export async function getStripeCheckoutResult(
  sessionId?: string | null,
): Promise<string> {
  const { data } = await apiClient.get<string>(
    "/payment-stripe/stripe/result",
    {
      params: sessionId ? { session_id: sessionId } : undefined,
    },
  );
  return data;
}

/**
 * POST /payment-stripe/renew — must match Payment Gateway Tester: primary call is
 * **no request body**, only `Authorization` + `x-api-key`. Axios `post(url, {})`
 * would send JSON and can trigger 500s on strict parsers; empty calls use `request`.
 * If that fails, retry with `session_id` (after Stripe success redirect).
 */
export async function renewSubscription(
  sessionId?: string | null,
): Promise<string> {
  // Tester uses `/renew` with no trailing slash first; FastAPI may also mount `/renew/`.
  const urls = ["/payment-stripe/renew", "/payment-stripe/renew/"] as const;
  const sid = sessionId?.trim();

  type Attempt =
    | { kind: "empty"; url: (typeof urls)[number] }
    | {
        kind: "json";
        url: (typeof urls)[number];
        body: Record<string, string>;
      };

  const attempts: Attempt[] = [];
  for (const url of urls) {
    attempts.push({ kind: "empty", url });
  }
  if (sid) {
    for (const url of urls) {
      attempts.push({ kind: "json", url, body: { session_id: sid } });
      attempts.push({ kind: "json", url, body: { checkout_session_id: sid } });
      attempts.push({
        kind: "json",
        url,
        body: {
          getaway: "STRIPE",
          gateway: "STRIPE",
          session_id: sid,
        },
      });
    }
  }
  for (const url of urls) {
    attempts.push(
      { kind: "json", url, body: { getaway: "STRIPE", gateway: "STRIPE" } },
      { kind: "json", url, body: { getaway: "STRIPE" } },
    );
  }

  let lastError: unknown;
  for (const step of attempts) {
    try {
      const res =
        step.kind === "empty"
          ? await apiClient.request<string>({ method: "POST", url: step.url })
          : await apiClient.post<string>(step.url, step.body);
      const data = res.data;
      if (typeof data === "string") return data;
      if (data != null) return String(data);
      return "";
    } catch (e) {
      lastError = e;
      if (is404(e)) continue;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Could not renew subscription");
}

/** Newest receipt by `receipt_date` / `created_at`, else last item in the API list. */
export function pickLatestReceiptId(
  receipts: PaymentReceipt[],
): string | null {
  if (!receipts.length) return null;
  const scored = receipts.map((r, index) => {
    const raw = r.receipt_date || r.created_at;
    const t = raw ? Date.parse(raw) : NaN;
    const ms = Number.isFinite(t) ? t : 0;
    return { id: r.id, ms, index };
  });
  scored.sort((a, b) => {
    if (b.ms !== a.ms) return b.ms - a.ms;
    return b.index - a.index;
  });
  return scored[0]?.id ?? null;
}

export async function getPaymentReceipt(receiptId: string): Promise<unknown> {
  const id = encodeURIComponent(receiptId);
  const paths = [
    `/payment-stripe/get-payment-receipt/${id}/`,
    `/payment-stripe/get-payment-receipt/${id}`,
  ] as const;
  let last: unknown;
  for (const path of paths) {
    try {
      const { data } = await apiClient.get(path);
      return data;
    } catch (e) {
      last = e;
      if (is404(e)) continue;
      throw e;
    }
  }
  throw last instanceof Error
    ? last
    : new Error("Could not load payment receipt");
}

/** PDF bill from GET /payment-stripe/get-payment-receipt/{receipt_id}/ */
export async function downloadPaymentReceiptPdf(
  receiptId: string,
): Promise<Blob> {
  const id = encodeURIComponent(receiptId);
  const paths = [
    `/payment-stripe/get-payment-receipt/${id}/`,
    `/payment-stripe/get-payment-receipt/${id}`,
  ] as const;
  let last: unknown;
  for (const path of paths) {
    try {
      const { data } = await apiClient.get<Blob>(path, {
        responseType: "blob",
        headers: { Accept: "application/pdf" },
      });
      return data;
    } catch (e) {
      last = e;
      if (is404(e)) continue;
      throw e;
    }
  }
  throw last instanceof Error
    ? last
    : new Error("Could not download receipt PDF");
}

export async function getPaymentReceipts(): Promise<PaymentReceipt[]> {
  // Payment Gateway Tester uses GET .../receipts (no slash). Try that first, then /receipts/.
  const paths = [
    "/payment-stripe/receipts",
    "/payment-stripe/receipts/",
  ] as const;
  for (const path of paths) {
    try {
      const { data } = await apiClient.get<PaymentReceipt[]>(path);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      if (is404(e)) continue;
      console.warn("[payment] receipts request failed:", path, e);
      return [];
    }
  }
  return [];
}

function isHttpUrlString(s: string): boolean {
  const t = s.trim();
  return t.startsWith("http://") || t.startsWith("https://");
}

const CHECKOUT_URL_KEYS = [
  "url",
  "checkout_url",
  "session_url",
  "redirect_url",
  "payment_url",
  "checkout_session_url",
  "stripe_url",
  "hosted_url",
] as const;

function pickUrlFromRecord(obj: Record<string, unknown>): string | null {
  for (const key of CHECKOUT_URL_KEYS) {
    const v = obj[key];
    if (typeof v === "string" && isHttpUrlString(v)) return v.trim();
  }
  return null;
}

/** Depth-first search for the first http(s) string (Stripe checkout pages, etc.). */
function findNestedHttpUrl(
  value: unknown,
  depth = 0,
  maxDepth = 8,
): string | null {
  if (depth > maxDepth || value === null || value === undefined) return null;
  if (typeof value === "string") {
    return isHttpUrlString(value) ? value.trim() : null;
  }
  if (typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findNestedHttpUrl(item, depth + 1, maxDepth);
      if (found) return found;
    }
    return null;
  }
  const rec = value as Record<string, unknown>;
  const direct = pickUrlFromRecord(rec);
  if (direct) return direct;
  for (const v of Object.values(rec)) {
    const found = findNestedHttpUrl(v, depth + 1, maxDepth);
    if (found) return found;
  }
  return null;
}

/**
 * Extracts a redirect URL from create-checkout responses.
 * Handles flat keys, nested objects (e.g. { data: { url } }), and JSON strings.
 */
export function resolveCheckoutRedirectUrl(
  res: unknown,
  depth = 0,
): string | null {
  if (depth > 12 || res === null || res === undefined) return null;

  if (typeof res === "string") {
    const t = res.trim();
    if (isHttpUrlString(t)) return t;
    try {
      const parsed: unknown = JSON.parse(t);
      return resolveCheckoutRedirectUrl(parsed, depth + 1);
    } catch {
      return null;
    }
  }

  if (typeof res === "object") {
    const rec = res as Record<string, unknown>;

    // Common wrappers: { data: {...} }, { result: {...} }, { payload: "..." }
    const detailObj =
      rec.detail !== null &&
      typeof rec.detail === "object" &&
      !Array.isArray(rec.detail)
        ? rec.detail
        : undefined;
    const wrapped =
      rec.data ??
      rec.result ??
      rec.body ??
      rec.response ??
      rec.checkout_session ??
      rec.checkout ??
      detailObj;
    if (wrapped !== undefined && wrapped !== res) {
      const fromWrapped = resolveCheckoutRedirectUrl(wrapped, depth + 1);
      if (fromWrapped) return fromWrapped;
    }

    const direct = pickUrlFromRecord(rec);
    if (direct) return direct;

    return findNestedHttpUrl(res, 0, 8);
  }

  return null;
}

export function useAllPlans() {
  return useCustomQuery({
    queryKey: ["plans", "all"],
    url: "/plan/All",
    staleTime: 1000 * 60 * 30,
  });
}

export function useCurrentPlan(enabled = true) {
  return useCustomQuery({
    queryKey: ["current-plan"],
    url: "/CurrentPlan",
    enabled,
    retry: 1,
    // After Stripe redirects to success, we need `/CurrentPlan` to refresh quickly.
    // Otherwise the UI may still show the old export limit.
    staleTime: 1000 * 10,
  });
}

export function useSubscriptionHistory(enabled = true) {
  return useCustomQuery({
    queryKey: ["subscription-history"],
    url: "/SubscriptionHistory",
    enabled,
    retry: 1,
  });
}

export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: createCheckoutSession,
  });
}

export function useCancelSubscription() {
  return useMutation({
    mutationFn: cancelSubscription,
  });
}

export function useCancelSubscriptionAtPeriodEnd() {
  return useMutation({
    mutationFn: cancelSubscriptionAtPeriodEnd,
  });
}

export function useResumeSubscription() {
  return useMutation({
    mutationFn: resumeSubscription,
  });
}
