export type VerificationType = "EMAIL_OTP" | "RESET" | "2FA";

export interface UserVerification {
  id: number;
  user_id: number;
  type: VerificationType;
  otp_hash: string | null;
  is_verified: 0 | 1;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}
