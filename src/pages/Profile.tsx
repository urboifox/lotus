import { useState } from "react";
import { User, Mail, CreditCard, Star } from "lucide-react";
import HelmetTitle from "@/components/HelmetTitle";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getProfile } from "@/services/profile";
import ProfileSection from "@/components/account/ProfileSection";
import EmailSection from "@/components/account/EmailSection";
import BillingSection from "@/components/account/BillingSection";
import SubscriptionSection from "@/components/account/SubscriptionSection";
import type { UserProfile } from "@/types/profile";

type TabId = "profile" | "email" | "billing" | "subscription";

const TABS: { id: TabId; label: string; Icon: React.ElementType }[] = [
  { id: "profile", label: "Profile", Icon: User },
  { id: "email", label: "Email & Security", Icon: Mail },
  { id: "billing", label: "Payment", Icon: CreditCard },
  { id: "subscription", label: "Subscription", Icon: Star },
];

export default function Profile() {
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const queryClient = useQueryClient();

  const {
    data: profile,
    isLoading,
    error,
    refetch,
  } = useQuery<UserProfile>({
    queryKey: ["profile"],
    queryFn: getProfile,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const handleUpdated = (updatedProfile?: UserProfile) => {
    if (updatedProfile) {
      queryClient.setQueryData<UserProfile>(["profile"], updatedProfile);
    }
    void queryClient.invalidateQueries({ queryKey: ["profile"] });
  };

  const sectionTitle: Record<TabId, string> = {
    profile: "Edit Profile",
    email: "Email & Security",
    billing: "Payment Methods",
    subscription: "Subscription & Plan",
  };

  return (
    <div className="min-h-screen pt-28 pb-16 px-4">
      <HelmetTitle title="Account Settings" description="Manage your account" />

      <div className="container max-w-3xl mx-auto">
        <h1 className="text-3xl font-playfair-display font-bold text-secondary mb-8">
          Account Settings
        </h1>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar tabs */}
          <aside className="md:w-52 shrink-0">
            <nav className="flex md:flex-col gap-1">
              {TABS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={[
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-poppins font-medium transition-colors text-left",
                    activeTab === id
                      ? "bg-primary text-secondary shadow-sm"
                      : "text-secondary/70 hover:bg-primary/30 hover:text-secondary",
                  ].join(" ")}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline md:inline">{label}</span>
                </button>
              ))}
            </nav>
          </aside>

          {/* Main panel */}
          <div className="flex-1">
            <div className="bg-[#F7D8AD] rounded-2xl border border-primary p-6 md:p-8 shadow-lg">
              <h2 className="text-xl font-playfair-display font-bold text-secondary mb-6">
                {sectionTitle[activeTab]}
              </h2>

              {isLoading && (
                <div className="flex justify-center py-12">
                  <div className="w-6 h-6 border-2 border-secondary/30 border-t-secondary rounded-full animate-spin" />
                </div>
              )}

              {!isLoading && error && (
                <div className="space-y-2 text-center py-8">
                  <p className="text-sm text-red-700 font-poppins">
                    {error instanceof Error ? error.message : "Could not load profile."}
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

              {!isLoading && !error && profile && (
                <>
                  {activeTab === "profile" && (
                    <ProfileSection profile={profile} onUpdated={handleUpdated} />
                  )}
                  {activeTab === "email" && (
                    <EmailSection
                      currentEmail={profile.email}
                      onUpdated={handleUpdated}
                    />
                  )}
                  {activeTab === "billing" && <BillingSection />}
                  {activeTab === "subscription" && <SubscriptionSection />}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
