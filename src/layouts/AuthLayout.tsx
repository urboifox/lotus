import { Outlet } from "react-router-dom";
import ScrollToTop from "@/components/ScrollToTop";
import { useOAuthCallback } from "@/hooks/useOAuthCallback";

function AuthLayout() {
  // Handle OAuth callback (Google/Microsoft login)
  useOAuthCallback();

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-200">
      <ScrollToTop />
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;
