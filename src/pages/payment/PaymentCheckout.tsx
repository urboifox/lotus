import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import HelmetTitle from "@/components/HelmetTitle";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  fetchPlanById,
  resolveCheckoutRedirectUrl,
  useCreateCheckoutSession,
} from "@/services/payment";
import type { BillingInformation, SubscriptionDuration } from "@/types/payment";

function parseUserFromStorage(): {
  email: string;
  firstName: string;
  lastName: string;
} {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return { email: "", firstName: "", lastName: "" };
    const u = JSON.parse(raw) as { email?: string; user_name?: string };
    const email = u.email ?? "";
    const parts = (u.user_name ?? "").trim().split(/\s+/);
    const firstName = parts[0] ?? "";
    const lastName = parts.slice(1).join(" ") || parts[0] || "";
    return { email, firstName, lastName };
  } catch {
    return { email: "", firstName: "", lastName: "" };
  }
}

export default function PaymentCheckout() {
  const [params] = useSearchParams();
  const planId = params.get("plan_id");
  const navigate = useNavigate();

  const { email, firstName: storedFirstName, lastName: storedLastName } =
    useMemo(() => parseUserFromStorage(), []);

  const {
    data: plan,
    isLoading: planLoading,
    error: planError,
  } = useQuery({
    queryKey: ["payment-plan", planId],
    queryFn: () =>
      planId
        ? fetchPlanById(planId)
        : Promise.reject(new Error("Missing plan id")),
    enabled: Boolean(planId),
    retry: 1,
  });

  const [duration, setDuration] = useState<SubscriptionDuration>("ANNUAL");
  const [firstName, setFirstName] = useState(storedFirstName);
  const [lastName, setLastName] = useState(storedLastName);
  const [emailAddress, setEmailAddress] = useState(email);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [postCode, setPostCode] = useState("");
  const [stateRegion, setStateRegion] = useState("");
  const [couponCode, setCouponCode] = useState("");

  const checkout = useCreateCheckoutSession();
  const isReady = Boolean(planId && plan) && !checkout.isPending;

  const billingInformation: BillingInformation = {
    first_name: firstName.trim(),
    last_name: lastName.trim(),
    phone_number: phoneNumber.trim(),
    email_address: emailAddress.trim(),
    street_address: streetAddress.trim(),
    country: country.trim(),
    city: city.trim(),
    post_code: Number.isFinite(parseInt(postCode, 10))
      ? parseInt(postCode, 10)
      : 0,
    state: stateRegion.trim(),
  };

  const handleConfirm = () => {
    if (!planId || !plan) return;

    checkout.mutate(
      {
        plan_id: planId,
        getaway: "STRIPE",
        subscription_duration: duration,
        billing_information: billingInformation,
        coupon_code: couponCode.trim() || undefined,
      },
      {
        onSuccess: (res) => {
          const url = resolveCheckoutRedirectUrl(res);
          if (url) {
            window.location.href = url;
            return;
          }

          console.error(
            "[create-checkout] No redirect URL found. Full response:",
            res,
          );
        },
      },
    );
  };

  if (!planId) {
    return (
      <div className="min-h-screen pt-32 pb-16 px-4">
        <HelmetTitle title="Checkout" description="Payment" />
        <div className="container max-w-lg mx-auto bg-[#F7D8AD] rounded-2xl border border-primary p-8 shadow-lg text-center">
          <h1 className="text-2xl font-playfair-display font-bold text-secondary mb-4">
            Missing plan
          </h1>
          <p className="text-secondary/80 font-poppins mb-6">
            Please select a plan again.
          </p>
          <button
            className="px-6 py-2.5 bg-[#ccaa83] text-white rounded-md font-medium"
            onClick={() => navigate("/writing")}
          >
            Back to writing
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-32 pb-16 px-4">
      <HelmetTitle title="Checkout" description="Payment" />
      <div className="container max-w-3xl mx-auto bg-[#FBF2E6] rounded-2xl border border-primary p-8 shadow-lg">
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-playfair-display font-bold text-secondary">
              Complete subscription
            </h1>
            <p className="text-secondary/80 font-poppins mt-2">
              Confirm to be redirected to the payment gateway.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/60 border border-primary/20">
            {planLoading && (
              <p className="text-sm text-secondary/80 font-poppins">
                Loading plan...
              </p>
            )}
            {!planLoading && planError && (
              <div className="space-y-2">
                <p className="text-sm font-poppins font-semibold text-secondary">
                  Plan details could not be loaded.
                </p>
                <p className="text-sm text-secondary/70 font-poppins">
                  Please return to the Subscription tab and choose Pro again.
                </p>
              </div>
            )}
            {!planLoading && plan && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="font-playfair-display font-semibold text-secondary">
                    {plan.description}
                  </div>
                  <div className="text-sm text-secondary/70 font-poppins">
                    {plan.export_limit} exports -{" "}
                    {plan.watermark ? "Watermark" : "No watermark"}
                  </div>
                </div>
                <div className="text-sm font-poppins text-secondary/80">
                  {plan.price_in_usd > 0
                    ? `$${plan.price_in_usd.toFixed(2)} USD`
                    : "Included"}
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="checkout-duration">Billing period</Label>
              <select
                id="checkout-duration"
                value={duration}
                onChange={(e) =>
                  setDuration(e.target.value as SubscriptionDuration)
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-poppins bg-white"
              >
                <option value="ANNUAL">Annual</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Payment gateway</Label>
              <div className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-poppins bg-white text-secondary/80">
                Stripe
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="checkout-first">First name</Label>
              <Input
                id="checkout-first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkout-last">Last name</Label>
              <Input
                id="checkout-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkout-email">Email</Label>
              <Input
                id="checkout-email"
                type="email"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkout-phone">Phone</Label>
              <Input
                id="checkout-phone"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="checkout-street">Street address</Label>
              <Input
                id="checkout-street"
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkout-country">Country</Label>
              <Input
                id="checkout-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkout-city">City</Label>
              <Input
                id="checkout-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkout-state">State / region</Label>
              <Input
                id="checkout-state"
                value={stateRegion}
                onChange={(e) => setStateRegion(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkout-post">Post code</Label>
              <Input
                id="checkout-post"
                value={postCode}
                onChange={(e) => setPostCode(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="checkout-coupon">Coupon (optional)</Label>
              <Input
                id="checkout-coupon"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3 justify-center pt-4">
            {checkout.isError && (
              <p className="basis-full text-center text-sm font-poppins text-red-700">
                {checkout.error instanceof Error
                  ? checkout.error.message
                  : "Checkout failed. Please try again."}
              </p>
            )}
            <button
              type="button"
              disabled={!isReady}
              onClick={handleConfirm}
              className="px-6 py-2.5 bg-[#ccaa83] text-white rounded-md font-medium disabled:opacity-50"
            >
              {checkout.isPending ? "Redirecting..." : "Confirm and authorize"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/writing")}
              className="px-6 py-2.5 border border-secondary/30 text-secondary rounded-md font-medium"
            >
              Cancel and return
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
