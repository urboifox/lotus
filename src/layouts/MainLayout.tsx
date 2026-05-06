import Header from "@/components/shared/Header";
import Footer from "@/components/shared/Footer";
import { Outlet } from "react-router-dom";
import ScrollToTop from "@/components/ScrollToTop";
import { useOAuthCallback } from "@/hooks/useOAuthCallback";

function MainLayout() {
  // Handle OAuth callback (Google/Microsoft login)
  useOAuthCallback();

  return (
    <div>
      <ScrollToTop />
      <Header />
      <Outlet />
      <Footer />
    </div>
  );
}

export default MainLayout;
