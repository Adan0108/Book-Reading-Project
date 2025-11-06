export interface AuthState {
    authUser: { id?: number, email: string, username?: string } | null;
    accessToken: string | null;
    isSigningUp: boolean;
    isLoggingIn: boolean;
    isVerifying: boolean;
    isResending: boolean;
    isSettingUpPassword: boolean;
    emailToVerify: string | null;
    


    signUp: (email: string) => Promise<boolean>;
    verifyOtp: (otp: string) => Promise<boolean>;
    resendOtp: () => Promise<void>;
    setupPassword: (username: string, password: string) => Promise<boolean>;
    login: (email: string, password: string) => Promise<boolean>;
    logout: () => Promise<void>;
}