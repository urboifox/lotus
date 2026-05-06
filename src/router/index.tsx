import Home from "@/pages/Home";
import About from "@/pages/About";
import Writing from "@/pages/Writing";
import Files from "@/pages/Files";
import Help from "@/pages/Help";
import Shop from "@/pages/Shop";
import Library from "@/pages/Library";
import Register from "@/pages/auth/Register";
import { createBrowserRouter } from "react-router-dom";
import MainLayout from "@/layouts/MainLayout";
import AuthLayout from "@/layouts/AuthLayout";
import NotFound from "@/components/shared/NotFound";
import Login from "@/pages/auth/Login";
// import SavedDocs from "@/pages/Saved-Docs";
import DocsDetails from "@/pages/DocsDetails";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import ResetPassword from "@/pages/auth/ResetPassword";
import Verify from "@/pages/auth/Verify";
import Profile from "@/pages/Profile";
import SharedFile from "@/pages/SharedFile";
import SharedDocument from "@/pages/SharedDocument";
import {
  PAYMENT_CANCEL_ROUTE,
  PAYMENT_SUCCESS_ROUTE,
} from "@/config/paymentRoutes";
import PaymentSuccess from "@/pages/payment/PaymentSuccess";
import PaymentCancel from "@/pages/payment/PaymentCancel";
import PaymentCheckout from "@/pages/payment/PaymentCheckout";
import ProtectedRoute from "@/components/ProtectedRoute";
import GuestRoute from "@/components/GuestRoute";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />,
    errorElement: <NotFound />,
    children: [
      { index: true, element: <Home /> },
      { path: "about", element: <About /> },
      {
        path: "writing",
        element: (
          <ProtectedRoute>
            <Writing />
          </ProtectedRoute>
        ),
      },
      {
        path: "files",
        element: (
          <ProtectedRoute>
            <Files />
          </ProtectedRoute>
        ),
      },
      { path: "help", element: <Help /> },
      { path: "library", element: <Library /> },
      { path: "shop", element: <Shop /> },
      { path: "profile", element: <ProtectedRoute><Profile /></ProtectedRoute> },
      { path: "payment/checkout", element: <ProtectedRoute><PaymentCheckout /></ProtectedRoute> },
      { path: PAYMENT_SUCCESS_ROUTE, element: <PaymentSuccess /> },
      { path: PAYMENT_CANCEL_ROUTE, element: <PaymentCancel /> },
      // { path: "saved-docs", element: <SavedDocs /> },
      { path: "docs/:id", element: <DocsDetails /> },
      {
        path: "share/:shareToken",
        element: (
          <ProtectedRoute>
            <SharedFile />
          </ProtectedRoute>
        ),
      },
      {
        path: "shared/document/:documentId",
        element: (
          <ProtectedRoute>
            <SharedDocument />
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    path: "/auth",
    element: (
      <GuestRoute>
        <AuthLayout />
      </GuestRoute>
    ),
    errorElement: <NotFound />,
    children: [
      { path: "register", element: <Register /> },
      { path: "login", element: <Login /> },
      { path: "forgot-password", element: <ForgotPassword /> },
      { path: "reset-password", element: <ResetPassword /> },
      { path: "verify", element: <Verify /> },
    ],
  },
]);
