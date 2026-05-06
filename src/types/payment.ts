export interface Plan {
  id: string;
  description: string;
  price: number;
  price_in_usd: number;
  type: string;
  order: number;
  export_limit: number;
  adding_new_symbols: boolean;
  watermark: boolean;
}

export interface CurrentPlan {
  plan_description: string;
  next_renewal_date?: string | null;
  current_period_end?: string | null;
  end_date?: string | null;
  next_plan?: string | null;
  export_limit: number;
  /** When the API returns usage, it takes precedence over local tracking. */
  exports_used?: number;
  adding_new_symbols: boolean;
  watermark: boolean;
  cancel_at_period_end?: boolean;
  status?: string | null;
  subscription_status?: string | null;
  plan_type?: string | null;
  type?: string | null;
  order?: number | null;
}

export interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
  funding?: string | null;
}

export interface SetupIntentResponse {
  client_secret: string;
  setup_intent_id: string;
}

export interface SubscriptionHistoryItem {
  receipt_id: string;
  status: string;
  change_date: string;
}

export type PaymentGateway = "STRIPE";

export type SubscriptionDuration = "ANNUAL" | "MONTHLY";

export interface BillingInformation {
  first_name: string;
  last_name: string;
  phone_number: string;
  email_address: string;
  street_address: string;
  country: string;
  city: string;
  post_code: number;
  state: string;
}

export interface CreateCheckoutPayload {
  plan_id: string;
  /** API field name (as documented). */
  getaway: PaymentGateway;
  subscription_duration: SubscriptionDuration;
  billing_information: BillingInformation;
  coupon_code?: string;
}

export interface PaymentReceipt {
  id: string;
  created_at: string;
  updated_by?: string;
  updated_at: string;
  is_deleted: boolean;
  purchase_id: string;
  merchant_transaction_id?: string;
  receipt_date: string;
}

/** Raw body from POST /payment-stripe/create-checkout (shape varies by backend). */
export type CreateCheckoutResponse = unknown;

export interface SubscribeWithSavedCardPayload {
  plan_id: string;
  payment_method_id: string;
  subscription_duration: SubscriptionDuration;
  coupon_code?: string;
  set_as_default?: boolean;
}

export interface SubscribeWithSavedCardResponse {
  status: "succeeded" | "requires_action" | "free" | string;
  message: string;
  plan_type?: string | null;
  amount?: string | null;
  payment_intent_id?: string | null;
  client_secret?: string | null;
  merchant_transaction_id?: string | null;
  free_subscription?: boolean;
  subscription_duration?: SubscriptionDuration;
}
