import axios from "axios";
import { useAuthStore } from "../store/useAuthStore";

export const api = axios.create({
  baseURL:
    import.meta.env.MODE === "development"
      ? "http://localhost:3000/v1/api"
      : "/v1/api",
  withCredentials: true,
  timeout: 30000,
});
let refreshInFlight: Promise<void> | null = null;
async function restoreSession() {
  if (!refreshInFlight)
    refreshInFlight = useAuthStore
      .getState()
      .refreshToken()
      .finally(() => {
        refreshInFlight = null;
      });
  await refreshInFlight;
}

api.interceptors.request.use(
  async (config) => {
    let state = useAuthStore.getState();
    // Optional-auth feeds can return 200 guest previews, so restore before the request.
    if (
      !state.accessToken &&
      !config.skipAuthRefresh &&
      localStorage.getItem("userId") &&
      !config.url?.startsWith("/access/")
    ) {
      await restoreSession();
      state = useAuthStore.getState();
    }
    const accessToken = state.accessToken;
    const authUser = state.authUser;

    // 1. Add Access Token (Authentication)
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    // 2. Add Client ID (Data for Logout/Profile/Refresh)
    // PRIORITIZE state, but FALLBACK to localStorage to survive page refreshes
    const userId = authUser?.id || localStorage.getItem("userId");

    if (userId) {
      config.headers["x-client-id"] = userId;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => {
    // If the request was successful, just pass it through normally
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // If the error is 401 (Unauthorized) and we haven't already tried to retry it
    const publicAuthOperation =
      originalRequest?.url?.startsWith("/access/") &&
      !["/access/logout", "/access/logout-all"].includes(originalRequest.url);
    const knownUser =
      useAuthStore.getState().authUser?.id || localStorage.getItem("userId");
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.skipAuthRefresh &&
      !publicAuthOperation &&
      knownUser
    ) {
      originalRequest._retry = true; // Mark it so we don't get stuck in an infinite loop

      try {
        await restoreSession();
        const newToken = useAuthStore.getState().accessToken;
        if (!newToken) throw new Error("Please sign in again.");

        originalRequest.headers.Authorization = `Bearer ${newToken}`;

        return api(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
