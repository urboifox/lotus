import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { notifyAuthChanged } from "@/utils/authSession";

export const useOAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const accessToken =
      searchParams.get("access_token") ||
      searchParams.get("token") ||
      searchParams.get("jwt");

    if (!accessToken) return;

    const email = searchParams.get("email") ?? "";
    const userName = searchParams.get("user_name") ?? "";
    const rolesParam = searchParams.get("roles") ?? "";

    const userData = {
      access_token: accessToken,
      email: decodeURIComponent(email),
      user_name: decodeURIComponent(userName),
      roles: rolesParam ? rolesParam.split(",") : ["user"],
    };

    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("token", accessToken);
    notifyAuthChanged();

    const returnTo = sessionStorage.getItem("lotus_auth_return_to");
    sessionStorage.removeItem("lotus_auth_return_to");
    navigate(
      returnTo && returnTo.startsWith("/") && !returnTo.startsWith("/auth/login")
        ? returnTo
        : window.location.pathname,
      { replace: true },
    );
    window.location.reload();
  }, [searchParams, navigate]);
};
