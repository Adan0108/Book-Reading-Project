import api from "../lib/axios";

export const authService = {
    signUp: async (email: string) => {
        const res = await api.post('/access/register-email', { email }, {withCredentials: true});
        return res.data;
    },

    verifyOtp: async (email: string, otp: string) => {
        const res = await api.post('/access/verify-email', { email, otp }, { withCredentials: true });
        return res.data;
    },

    ResendOtp: async (email: string, otp: string) => {
        const res = await api.post('/access/resend-otp', { email, otp }, { withCredentials: true });
        return res.data;
    },

    setupPassword: async (email: string, username: string, password: string) => {
        const res = await api.post('/access/setup-password', { email, username, password }, { withCredentials: true });
        return res.data;
    },

    login: async (email: string, password: string) => {
        const res = await api.post('/access/login', { email, password }, { withCredentials: true });
        return res.data;
    },

    logout: async (id: number) => {
        const res = await api.post('/access/logout', {id}, { withCredentials: true });
        return res.data;
    }
}