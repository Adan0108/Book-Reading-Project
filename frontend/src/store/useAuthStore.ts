import {create} from 'zustand';
import {toast} from 'sonner';
import { authService } from '../services/authService';
import type { AuthState } from '../type/store';
import { persist } from 'zustand/middleware';

export const useAuthStore = create<AuthState>()((set, get) => ({
        
        authUser: null,
        accessToken: null,
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

            } catch (error) {
                
                console.error('Sign up error:', error);
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
                set({authUser: data.user});
                toast.success("Verification successful!");
                return true;
            }
            catch (error) {
                console.error('OTP verification error:', error);
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
            catch(error) {
                console.error("Resend OTP error:", error);
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
                const data = await authService.setupPassword(email, username, password);
                
                // Profile is set! Store the user, clear the email, and celebrate.
                set({ authUser: data.user, emailToVerify: null }); 
                toast.success("Profile complete! Welcome.");
                return true;

            } catch (error) {
                console.error("Setup password error:", error);
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
                console.log("Login successful:", data);

                if (data.metadata.user.id) {
                    localStorage.setItem('userId', data.metadata.user.id.toString());
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
            catch (error) {
                console.error("Login error:", error);
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

            if (!authUser) {
                set({ authUser: null, emailToVerify: null, accessToken: null });
                return;
            }

            if (!userId) {
                // Just clear local state if we don't have an ID
                set({ authUser: null, emailToVerify: null, accessToken: null });
                localStorage.removeItem('userId'); 
                return;
            }

            try {
                const response = await authService.logout(userId);
                console.log('Logout successful:', response);
            }
            catch (error) {
                console.error("Logout API call failed:", error);
                toast.error("Logout failed on server, but clearing local session.")
            }
            finally {
                localStorage.removeItem('userId');
                set({ authUser: null, emailToVerify: null, accessToken: null });
                toast.success("You have been logged out.");
            }
        },

        forgotPassword: async (email: string) => {
            set({ isRequestingReset: true, emailToVerify: email });

            try {
                await authService.forgotPassword(email);
                toast.success('A password reset code has been sent to your email.');
                return true;
            }
            catch (error) {
                console.error('Forgot password error:', error);
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
            catch (error) {
                console.error("Reset password error:", error);
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
            catch (error) {
                console.error("Resend password reset error:", error);
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
                
                const accessToken = await authService.refreshToken();
                
                console.log("Token refreshed:", accessToken);
                
                // 2. Set the token immediately so fetchMe can use it
                set({ accessToken });

                // 3. Chain the call: Now that we have a token, get the user details
                await get().fetchMe();
            }
            catch (error){
                console.log("Refresh failed (User likely not logged in):", error);
                // If refresh fails, clear everything including localStorage
                localStorage.removeItem('userId');
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
                const data = await authService.fetchMe();
                
                // --- FIX 3: Drill down into 'metadata' ---
                // Your backend returns { message: "...", metadata: { id: 1, ... } }
                // So we must store data.metadata, not the whole data object
                if (data.metadata) {
                    set({ authUser: data.metadata });
                } else {
                    // Fallback in case your API structure varies
                    set({ authUser: data }); 
                }
                
                console.log("Fetched user data:", data.metadata);
            } catch (error) {
                console.error("Fetch user error:", error);
                set({ authUser: null, accessToken: null });
            } finally {
                set({ isFetchingUser: false });
            }
        }
    
    }),
);