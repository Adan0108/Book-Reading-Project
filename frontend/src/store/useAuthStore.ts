import {create} from 'zustand';
import {toast} from 'sonner';
import { authService } from '../services/authService';
import {isAxiosError} from 'axios';
import type { AuthState } from '../type/store';

export const useAuthStore = create<AuthState>()((set, get) => ({

        authUser: null,
        accessToken: null,
        setupToken: null,
        isSigningUp: false,
        isLoggingIn: false,
        isVerifying: false,
        isResending: false,
        isSettingUpPassword: false,
        isRequestingReset: false,
        isResettingPassword: false,
        isResendingReset: false,
        isRefreshingToken: false,
        isFetchingUser: false,
        emailToVerify: null,

        signUp: async (email: string) => {
            set({isSigningUp: true, emailToVerify: email});
            try {

                await authService.signUp(email);
                set({ authUser: { email } });
                toast.success('An OTP has been sent to your email!');
                return true;

            } catch {

                toast.error('Sign up failed. Please try again.');
                return false;

            } finally {
                set({ isSigningUp: false });
            }
        },

        verifyOtp: async (otp: string) => {
            set({isVerifying: true});
            const email = get().emailToVerify;

            if (!email) {
                toast.error("An error occurred. Please sign up again.");
                set({ isVerifying: false });
                return false;
            }

            try {
                const data = await authService.verifyOtp(email, otp);
                set({setupToken: data.metadata.setupToken});
                toast.success("Verification successful!");
                return true;
            }
            catch {
                toast.error("Invalid or expired OTP. Please try again.");
                return false;
            }
            finally {
                set({ isVerifying: false });
            }

        },

        resendOtp: async () => {
            set({ isResending: true});
            const email = get().emailToVerify;

            if (!email){
                toast.error("An error occurred. Please go back.");
                set({ isResending: false });
                return;
            }

            try {
                await authService.ResendOtp(email);
                toast.success("A new code has been sent.");
            }
            catch {
                toast.error("Failed to resend code. Please try again.");
            }
            finally {
                set({ isResending: false });
            }
        },

        setupPassword: async (username: string, password: string) => {
            set({ isSettingUpPassword: true });
            const email = get().emailToVerify;

            if (!email) {
                toast.error("An error occurred. Please sign up again.");
                set({ isSettingUpPassword: false });
                return false;
            }

            try {
                // Call the service with all three pieces of data
                const data = await authService.setupPassword(email, username, password, get().setupToken ?? '');

                // Profile is set! Store the user, clear the email, and celebrate.
                set({ authUser: data.metadata.user, emailToVerify: null, setupToken: null });
                toast.success("Profile complete! Welcome.");
                return true;

            } catch {
                toast.error("Failed to set up profile. Please try again.");
                return false;
            } finally {
                set({ isSettingUpPassword: false });
            }
        },

        login: async (email: string, password: string) => {
            set ({ isLoggingIn: true});

            try {
                const data = await authService.login(email, password);


                if (data.metadata.user.id) {
                    localStorage.setItem('userId', data.metadata.user.id.toString());
                }

                if (data.metadata.tokens.accessToken) {
                    localStorage.removeItem('accessToken');
                }

                // 1. Set the token FIRST so the subsequent request is authenticated
                set({
                    accessToken: data.metadata.tokens.accessToken,
                    emailToVerify: null,
                    authUser: data.metadata.user
                });

                // 2. Call fetchMe to get the full profile (username, etc.)
                // This ensures the state matches exactly what 'refreshToken' produces
                // await get().fetchMe();

                toast.success("Login successful! Welcome back.");
                return true;
            }
            catch {
                toast.error("Invalid email or password. Please try again.");
                return false;
            }
            finally {
                set({ isLoggingIn: false });
            }
        },

        logout: async () => {
            const authUser = get().authUser;
            const userId = authUser?.id || Number(localStorage.getItem('userId'));

            if (!userId) {
                // Just clear local state if we don't have an ID
                set({ authUser: null, emailToVerify: null, accessToken: null });
                localStorage.removeItem('userId');
                localStorage.removeItem('accessToken');
                return;
            }

            try {
                await authService.logout(userId);
            }
            catch {
                toast.error("Server sign-out could not be confirmed. Reconnect and sign out again.")
            }
            finally {
                localStorage.removeItem('userId');
                localStorage.removeItem('accessToken');
                set({ authUser: null, emailToVerify: null, accessToken: null });
            }
        },

        forgotPassword: async (email: string) => {
            set({ isRequestingReset: true, emailToVerify: email });

            try {
                await authService.forgotPassword(email);
                toast.success('A password reset code has been sent to your email.');
                return true;
            }
            catch {
                toast.error('Failed to send reset email. Please try again.');
                set({ emailToVerify: null });
                return false;
            }
            finally {
                set({ isRequestingReset: false });
            }
        },

        resetPassword: async (otp: string, newPassword: string) => {
            set({ isResettingPassword: true });
            const email = get().emailToVerify;

            if (!email) {
                toast.error("An error occurred. Please try again.");
                set({ isResettingPassword: false });
                return false;
            }

            try {
                await authService.resetPassword(email, otp, newPassword);

                // It worked! Clear the email and send a success toast.
                set({ emailToVerify: null });
                toast.success("Password has been reset successfully!");
                return true;
            }
            catch {
                toast.error("Invalid or expired OTP. Please try again.");
                return false;
            }
            finally {
                set({ isResettingPassword: false });
            }
        },

        resendPasswordReset: async () => {
            set({ isResendingReset: true });
            const email = get().emailToVerify;

            if (!email) {
                toast.error("An error occurred. Please go back.");
                set({ isResendingReset: false });
                return;
            }

            try {
                await authService.forgotPassword(email);
                toast.success("A new code has been sent.");
            }
            catch {
                toast.error("Failed to resend code. Please try again.");
            }
            finally {
                set({ isResendingReset: false });
            }
        },

        refreshToken: async () => {

            const { isRefreshingToken } = get();
            if (isRefreshingToken) return;

            set({ isRefreshingToken: true });
            try{

                // Serialize cookie rotation across tabs as well as requests in this tab.
                const accessToken = navigator.locks
                    ? await navigator.locks.request('hibook-session-refresh', () => authService.refreshToken())
                    : await authService.refreshToken();


                // Access tokens stay in memory; the HttpOnly cookie restores a session.
                localStorage.removeItem('accessToken');

                // 2. Set the token immediately so fetchMe can use it
                set({ accessToken });

                // Profile failures must propagate so an outage is not treated as a restored session.
                set({authUser:await authService.fetchMe()});
            }
            catch(error){
                if(!isAxiosError(error)||error.response?.status!==401)throw error;
                // If refresh fails, clear everything including localStorage
                localStorage.removeItem('userId');
                localStorage.removeItem('accessToken');
                set({
                    authUser: null,
                    accessToken: null,
                });
            }
            finally {
                set({ isRefreshingToken: false });
            }

        },

        fetchMe: async () => {
            set({ isFetchingUser: true });
            try {
                set({authUser:await authService.fetchMe()});
            } catch(error) {
                if(isAxiosError(error)&&error.response?.status===401)set({ authUser: null, accessToken: null });
            } finally {
                set({ isFetchingUser: false });
            }
        }

    }),
);
