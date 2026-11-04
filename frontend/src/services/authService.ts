import api from "../lib/axios";
import {isAxiosError} from 'axios';
import type {AuthState} from '../type/store';

export const authService = {
    signUp: async (email: string) => {
        const res = await api.post('/access/register-email', { email }, {withCredentials: true});
        return res.data;
    },

    verifyOtp: async (email: string, otp: string) => {
        const res = await api.post('/access/verify-email', { email, otp }, { withCredentials: true });
        return res.data;
    },

    ResendOtp: async (email: string) => {
        const res = await api.post('/access/resend-otp', { email }, { withCredentials: true });
        return res.data;
    },

    setupPassword: async (email: string, username: string, password: string, setupToken: string) => {
        const res = await api.post('/access/setup-password', { email, username, password, setupToken }, { withCredentials: true });
        return res.data;
    },

    login: async (email: string, password: string) => {
        const res = await api.post('/access/login', { email, password }, { withCredentials: true });
        return res.data;
    },

    logout: async (id: number) => {
        const res = await api.post('/access/logout', {id}, { withCredentials: true });
        return res.data;
    },

    forgotPassword: async (email:string) => {
        const res = await api.post('/access/forgot-password', { email }, { withCredentials: true });
        return res.data;
    },

    resetPassword: async (email: string, otp: string, newPassword: string) => {
        const res = await api.post('/access/reset-password', { email, otp, newPassword }, { withCredentials: true });
        return res.data;
    },

    refreshToken: async () => {
        try {
            const session=await api.post('/access/session',{});
            return session.data.metadata.tokens.accessToken;
        } catch(error) {
            if(!isAxiosError(error)||error.response?.status!==401) throw error;
        }
        const res = await api.post('/access/refresh', {}, { withCredentials: true });
        return res.data.metadata.tokens.accessToken;
    },

    fetchMe : async () => {
        const res = await api.get<{metadata:NonNullable<AuthState['authUser']>}>('/user/me', { withCredentials: true });
        return res.data.metadata;
    }
}
