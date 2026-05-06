import axios, { type InternalAxiosRequestConfig } from "axios";
import { clearStoredAuth } from "@/utils/authSession";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

const getErrorDetail = (detailRaw: unknown) => {
  if (typeof detailRaw === "string") return detailRaw;

  if (detailRaw && typeof detailRaw === "object") {
    return String(
      (detailRaw as { message?: unknown; error?: unknown; detail?: unknown })
        .message ??
        (detailRaw as { message?: unknown; error?: unknown; detail?: unknown })
          .error ??
        (detailRaw as { message?: unknown; error?: unknown; detail?: unknown })
          .detail ??
        JSON.stringify(detailRaw),
    );
  }

  return detailRaw != null ? String(detailRaw) : undefined;
};

const rejectApiError = (message: string, detailRaw?: unknown) => {
  const apiError = new Error(message) as Error & {
    retry_after_seconds?: number;
    active_editor_name?: string;
    expires_at?: string;
  };
  if (detailRaw && typeof detailRaw === "object") {
    const detail = detailRaw as {
      retry_after_seconds?: unknown;
      active_editor_name?: unknown;
      expires_at?: unknown;
    };
    if (typeof detail.retry_after_seconds === "number") {
      apiError.retry_after_seconds = detail.retry_after_seconds;
    }
    if (typeof detail.active_editor_name === "string") {
      apiError.active_editor_name = detail.active_editor_name;
    }
    if (typeof detail.expires_at === "string") {
      apiError.expires_at = detail.expires_at;
    }
  }
  return Promise.reject(apiError);
};

const confirmedAuthFailureDetails = new Set([
  "access_token_expired",
  "invalid_access_token",
  "invalid_authorization_header",
  "invalid_credentials",
  "invalid_refresh_token",
  "invalid_refresh_token_simple",
  "invalid_token",
  "no_refresh_token_provided",
  "no_refresh_token_provided_simple",
  "refresh_token_expired",
  "token_has_expired",
]);

const refreshFailureDetails = new Set([
  "invalid_refresh_token",
  "invalid_refresh_token_simple",
  "no_refresh_token_provided",
  "no_refresh_token_provided_simple",
  "refresh_token_expired",
]);

const isExpiredAccessToken = (status?: number, detail?: string) =>
  (status === 401 || status === 403) &&
  (detail === "access_token_expired" ||
    detail === "token_has_expired" ||
    detail === "ErrorCode.ACCESS_TOKEN_EXPIRED");

const isConfirmedAuthFailure = (status?: number, detail?: string) =>
  (status === 401 || status === 403) &&
  Boolean(detail && confirmedAuthFailureDetails.has(detail));

const redirectToLogin = () => {
  if (window.location.pathname !== "/auth/login") {
    const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.assign(`/auth/login?return_to=${encodeURIComponent(returnTo)}`);
  }
};

apiClient.interceptors.request.use((config) => {
  const apiKey = import.meta.env.VITE_API_KEY;
  if (apiKey) {
    config.headers["x-api-key"] = apiKey;
  }
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const detail = getErrorDetail(error.response?.data?.detail);

    const originalRequest = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    if (
      isExpiredAccessToken(status, detail) &&
      originalRequest &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;
      const currentToken = localStorage.getItem("token");

      if (currentToken) {
        try {
          const { data } = await axios.post<{ access_token: string }>(
            `${import.meta.env.VITE_API_URL}/refresh-token`,
            {},
            {
              headers: {
                Authorization: `Bearer ${currentToken}`,
                "x-api-key": import.meta.env.VITE_API_KEY,
              },
              withCredentials: true,
            },
          );

          localStorage.setItem("token", data.access_token);
          originalRequest.headers = originalRequest.headers ?? {};
          originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
          return apiClient(originalRequest);
        } catch (refreshError) {
          const refreshStatus = axios.isAxiosError(refreshError)
            ? refreshError.response?.status
            : undefined;
          const refreshDetail = axios.isAxiosError(refreshError)
            ? getErrorDetail(refreshError.response?.data?.detail)
            : undefined;

          if (
            (refreshStatus === 401 || refreshStatus === 403) &&
            refreshDetail &&
            refreshFailureDetails.has(refreshDetail)
          ) {
            clearStoredAuth();
            redirectToLogin();
            return Promise.reject(
              new Error("Session expired. Please login again."),
            );
          }

          return rejectApiError(
            refreshDetail || detail || "Session refresh failed.",
            axios.isAxiosError(refreshError) ? refreshError.response?.data?.detail : undefined,
          );
        }
      }
    }

    if (isConfirmedAuthFailure(status, detail)) {
      const hasToken = Boolean(localStorage.getItem("token"));
      if (hasToken) {
        clearStoredAuth();
        redirectToLogin();
        return Promise.reject(
          new Error("Session expired. Please login again."),
        );
      }
      return Promise.reject(new Error("Unauthorized request."));
    }

    if (status === 403 && detail === "docs_limit_reached") {
      return Promise.reject(new Error("Docs limit reached."));
    }

    if (status === 404 && error.config?.url?.includes("/login")) {
      return Promise.reject(new Error("Invalid email or password"));
    }

    const message =
      detail ||
      error.response?.data?.message ||
      error.message ||
      "An error occurred";
    return rejectApiError(message, error.response?.data?.detail);
  },
);
