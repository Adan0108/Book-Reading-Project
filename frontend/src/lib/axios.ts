import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

export const api = axios.create({
    baseURL: import.meta.env.MODE === 'development' ? 'http://localhost:3000/v1/api' : 'v1/api',
    withCredentials: true,
})

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

export default api;