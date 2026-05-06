/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_API_KEY?: string;
  /**
   * Documented for backend / deployment; optional on the client.
   * Success URL usually includes the literal `{CHECKOUT_SESSION_ID}` for Stripe.
   */
  readonly VITE_STRIPE_SUCCESS_URL?: string;
  readonly VITE_STRIPE_CANCEL_URL?: string;
}
