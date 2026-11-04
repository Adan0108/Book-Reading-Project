import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

export const api = axios.create({
    baseURL: import.meta.env.MODE === 'development' ? 'http://localhost:3000/v1/api' : '/v1/api',
    withCredentials: true,
})
let refreshInFlight: Promise<void> | null = null;

api.interceptors.request.use(
  (config) => {
    const state = useAuthStore.getState();
    const accessToken = state.accessToken;
    const authUser = state.authUser;

    // 1. Add Access Token (Authentication)
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    // 2. Add Client ID (Data for Logout/Profile/Refresh)
    // PRIORITIZE state, but FALLBACK to localStorage to survive page refreshes
    const userId = authUser?.id || localStorage.getItem('userId');
    
    if (userId) {
      config.headers['x-client-id'] = userId;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Add this BELOW your existing request interceptor!

api.interceptors.response.use(
  (response) => {
    // If the request was successful, just pass it through normally
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // If the error is 401 (Unauthorized) and we haven't already tried to retry it
    const publicAuthOperation = originalRequest?.url?.startsWith('/access/') &&
      !['/access/logout','/access/logout-all'].includes(originalRequest.url);
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !publicAuthOperation) {
      
      // CRITICAL: If the refresh token endpoint itself returns 401, DO NOT retry. 
      // This means their session is completely dead and they actually need to log in.

      originalRequest._retry = true; // Mark it so we don't get stuck in an infinite loop

      try {
        // 1. Tell your store to go get a fresh token
        if (!refreshInFlight) {
          refreshInFlight = useAuthStore.getState().refreshToken().finally(() => { refreshInFlight = null; });
        }
        await refreshInFlight;

        // 2. Grab the shiny new token that was just saved
        const newToken = useAuthStore.getState().accessToken;
        if (!newToken) throw new Error('Please sign in again.');

        // 3. Swap out the old, revoked token for the new one in the headers
        originalRequest.headers.Authorization = `Bearer ${newToken}`;

        // 4. Retry the exact same request! (The user won't even notice it failed the first time)
        return api(originalRequest);
        
      } catch (refreshError) {
        // If the refresh fails, their session is over. Log them out.
        useAuthStore.setState({ authUser: null, accessToken: null });
        localStorage.removeItem('userId');
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
