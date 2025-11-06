import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

export const api = axios.create({
    baseURL: import.meta.env.MODE === 'development' ? 'http://localhost:3000/v1/api' : 'v1/api',
    withCredentials: true,
})

api.interceptors.request.use(
    (config) => {
      // 1. Get the entire store's state
      const state = useAuthStore.getState();
      const accessToken = state.accessToken;
      const authUser = state.authUser;
  
      // 2. Add the Authorization token if it exists
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
  
      // --- THIS IS THE FIX ---
      // 3. Add the user's ID as the x-client-id
      //    This is for protected routes like /logout or /profile
      if (authUser && authUser.id) {
        config.headers['x-client-id'] = authUser.id;
      }
      // --- END OF FIX ---
  
      // Note: For *non-protected* routes (like /login), the backend
      // might require a different static client ID. If it does,
      // you'll need to add an 'else' block here.
      // else {
      //   config.headers['x-client-id'] = import.meta.env.VITE_STATIC_CLIENT_ID;
      // }
  
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
);

export default api;