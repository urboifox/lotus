import { apiClient } from "@/config/axios.config";
import type {
  PaymentMethod,
  SetupIntentResponse,
  SubscribeWithSavedCardPayload,
  SubscribeWithSavedCardResponse,
} from "@/types/payment";

/** GET /payment-stripe/payment-methods — list saved cards */
export async function getMyCards(): Promise<PaymentMethod[]> {
  const { data } = await apiClient.get<PaymentMethod[]>("/payment-stripe/payment-methods");
  return Array.isArray(data) ? data : [];
}

/** POST /payment-stripe/setup-intent — create SetupIntent for adding a new card */
export async function createSetupIntent(): Promise<SetupIntentResponse> {
  const { data } = await apiClient.post<SetupIntentResponse>("/payment-stripe/setup-intent");
  return data;
}

/** POST /payment-stripe/payment-methods/confirm — save card after SetupIntent */
export async function confirmPaymentMethod(
  paymentMethodId: string,
  makeDefault = false,
): Promise<{ id: string; last4: string; brand: string }> {
  const { data } = await apiClient.post("/payment-stripe/payment-methods/confirm", {
    payment_method_id: paymentMethodId,
    make_default: makeDefault,
  });
  return data;
}

/** POST /payment-stripe/payment-methods/{pm_id}/set-default */
export async function setDefaultCard(pmId: string): Promise<void> {
  await apiClient.post(`/payment-stripe/payment-methods/${pmId}/set-default`);
}

/** DELETE /payment-stripe/payment-methods/{pm_id} */
export async function deleteCard(pmId: string): Promise<void> {
  await apiClient.delete(`/payment-stripe/payment-methods/${pmId}`);
}

/** POST /payment-stripe/subscription/subscribe-with-saved-card */
export async function subscribeWithSavedCard(
  payload: SubscribeWithSavedCardPayload,
): Promise<SubscribeWithSavedCardResponse> {
  const { data } = await apiClient.post<SubscribeWithSavedCardResponse>(
    "/payment-stripe/subscription/subscribe-with-saved-card",
    payload,
  );
  return data;
}

/** POST /payment-stripe/subscription/confirm-saved-card-payment */
export async function confirmSavedCardPayment(payload: {
  plan_id: string;
  payment_method_id: string;
  payment_intent_id: string;
  subscription_duration: "MONTHLY" | "ANNUAL";
}): Promise<SubscribeWithSavedCardResponse> {
  const { data } = await apiClient.post<SubscribeWithSavedCardResponse>(
    "/payment-stripe/subscription/confirm-saved-card-payment",
    payload,
  );
  return data;
}
