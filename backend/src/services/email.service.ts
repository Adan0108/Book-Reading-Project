export const sendRegistrationOtp = async ({ email, otp }: { email: string; otp: string; }) => {
  console.log(`
    ================================================
    📧 Mock Email Sent to: ${email}
    ✅ Your account verification OTP is: ${otp}
    (This OTP will expire in 5 minutes)
    ================================================
  `);
  return true;
};

export const sendResetPasswordOtp = async ({ email, otp }: { email: string; otp: string; }) => {
  console.log(`
    ================================================
    📧 Mock Email Sent to: ${email}
    🔑 Your password reset OTP is: ${otp}
    (This OTP will expire in 5 minutes)
    ================================================
  `);
  // In production, you would integrate with a real email provider here.
  // e.g., await sendgrid.send({ to: email, subject: 'Your OTP', text: ... });
  return true;
};