/**
 * Paths for payment result pages, driven by VITE_STRIPE_*_URL in `.env`.
 * Supports relative paths (`/payment/success?...`) or absolute URLs (pathname only is used for routing).
 */

function pathnameFromEnv(raw: string | undefined, fallback: string): string {
  if (!raw?.trim()) return fallback;
  const t = raw.trim();
  if (t.startsWith("http://") || t.startsWith("https://")) {
    try {
      const p = new URL(t).pathname;
      return p && p !== "/" ? p : fallback;
    } catch {
      return fallback;
    }
  }
  const pathOnly = t.split("?")[0].split("#")[0].trim();
  if (!pathOnly || pathOnly === "/") return fallback;
  return pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`;
}

/** Use with `<Link to={...}>` / `navigate(...)`. */
export const PAYMENT_SUCCESS_PATH = pathnameFromEnv(
  import.meta.env.VITE_STRIPE_SUCCESS_URL,
  "/payment/success",
);

export const PAYMENT_CANCEL_PATH = pathnameFromEnv(
  import.meta.env.VITE_STRIPE_CANCEL_URL,
  "/payment/cancel",
);

/** Child route segments under `/` (no leading slash), for `createBrowserRouter`. */
export const PAYMENT_SUCCESS_ROUTE = PAYMENT_SUCCESS_PATH.replace(/^\/+/, "");
export const PAYMENT_CANCEL_ROUTE = PAYMENT_CANCEL_PATH.replace(/^\/+/, "");
