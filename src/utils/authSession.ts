import { useEffect, useState } from "react";

export interface StoredUser {
  access_token?: string;
  email?: string;
  roles?: string[];
  name?: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  user_name?: string;
  profile_picture?: string | null;
  avatar_url?: string | null;
  avatar?: string | null;
  avatar_updated_at?: number;
}

const AUTH_CHANGED_EVENT = "lotus-auth-changed";

export const getStoredToken = () => localStorage.getItem("token");

export const getStoredUser = (): StoredUser | null => {
  const userData = localStorage.getItem("user");
  if (!userData) return null;

  try {
    return JSON.parse(userData) as StoredUser;
  } catch {
    return null;
  }
};

export const notifyAuthChanged = () => {
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
};

export const clearStoredAuth = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  notifyAuthChanged();
};

export const useStoredAuth = () => {
  const [authState, setAuthState] = useState({
    isLoading: true,
    isAuthenticated: false,
    user: null as StoredUser | null,
  });

  useEffect(() => {
    const syncAuth = () => {
      const user = getStoredUser();
      setAuthState({
        isLoading: false,
        isAuthenticated: Boolean(getStoredToken() && user),
        user,
      });
    };

    syncAuth();
    window.addEventListener("storage", syncAuth);
    window.addEventListener(AUTH_CHANGED_EVENT, syncAuth);

    return () => {
      window.removeEventListener("storage", syncAuth);
      window.removeEventListener(AUTH_CHANGED_EVENT, syncAuth);
    };
  }, []);

  return authState;
};
