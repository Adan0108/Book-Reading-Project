import React, {useState, useEffect} from 'react'
import { useNavigate } from 'react-router-dom'
import { FiArrowLeft, FiLock, FiEye, FiEyeOff } from 'react-icons/fi'
import { toast } from 'sonner'

import { useAuthStore } from '../../store/useAuthStore'
import type { AuthState } from '../../type/store'
import OTPInput from 'react-otp-input'

const password = () => {

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [otp, setOtp] = useState('');
  
  const navigate = useNavigate();

  const resetPassword = useAuthStore((state: AuthState) => state.resetPassword);
  const isResettingPassword = useAuthStore((state: AuthState) => state.isResettingPassword);
  const emailToVerify = useAuthStore((state: AuthState) => state.emailToVerify);

  const resendPasswordReset = useAuthStore((state: AuthState) => state.resendPasswordReset);
  const isResendingReset = useAuthStore((state: AuthState) => state.isResendingReset);

  useEffect(() => {
    if (countdown === 0) return;
    const intervalId = setInterval(() => {
      setCountdown((prevCountdown) => prevCountdown - 1);
    }, 1000);
    return () => clearInterval(intervalId);
  }, [countdown]);
  
  const handleBack = () => {
    navigate('/login');
  };

  const handleResend = async () => {
    await resendPasswordReset();
    setCountdown(60); // Reset timer
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const newPassword = formData.get('password') as string;
    const confirmPassword = formData.get('confirm-password') as string;

    if (otp.length < 6) {
      toast.error("Please enter the 6-digit OTP.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }

    const success = await resetPassword(otp, newPassword);

    if (success) {
      navigate('/login'); // All done, go to login!
    } else {
      setOtp(''); // Clear OTP on failure
    }

  }

  return (
    <div
      className = "flex items-start justify-center min-h-screen bg-gray-100 p-4 pt-2"
      style={{
        backgroundImage: `url('/background.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className = "flex flex-col items-center justify-center w-full max-w-4xl px-4">
        <div className = "w-full max-w-md pt-4 px-8 pb-8 bg-white rounded-xl shadow-lg">

          {/* Header with Back Arrow and Logo */}
          <div className="relative flex justify-center items-center ">
            <button onClick={handleBack} className="absolute left-0 text-gray-500 hover:text-gray-800">
              <FiArrowLeft size={24} />
            </button>
            <div className="flex justify-center">
              <img className="h-32 w-auto" src="/Name.svg" alt="MeoMic Logo" />
            </div>
          </div>

          {/* Email Pill */}
          <div className="flex justify-center mb-6">
            <div className="px-4 py-2 text-sm text-gray-700 bg-gray-100 border border-gray-300 rounded-full">
              {emailToVerify || "your-email@example.com"}
            </div>
          </div>

          {/* Titles */}
          <div className="text-center">
            <h2 className="text-2xl font-bold">Set a new password</h2>
            <p className="mt-1 text-gray-500">Enter the OTP and your new password</p>
          </div>

          <form className = "space-y-6 mt-6" onSubmit={handleSubmit}>

            {/* OTP input field */}
            <div>
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-gray-700">
                  Verification Code
                </label>
                <button 
                  type="button" // Prevents form submission
                  onClick={handleResend}
                  disabled={isResendingReset || countdown > 0 || isResettingPassword}
                  className="text-sm font-medium text-blue-600 hover:text-blue-500
                             disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  {isResendingReset 
                    ? 'Sending...' 
                    : (countdown > 0 ? `Resend (${countdown}s)` : 'Resend code')}
                </button>
              </div>
              <div className="mt-1">
                <OTPInput
                  value={otp}
                  onChange={setOtp}
                  numInputs={6}
                  containerStyle="justify-between"
                  renderSeparator={<span className="w-1" />} 
                  renderInput={(props) => (
                    <input
                      {...props}
                      style={{}}
                      disabled={isResettingPassword}
                      className="!w-12 !h-14 sm:!w-12 sm:!h-12 text-center text-2xl border border-gray-300 rounded-md 
                                 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600
                                 disabled:bg-gray-100"
                    />
                  )}
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="text-sm font-medium text-gray-700">
                New Password
              </label>
              <div className="relative mt-1">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                  <FiLock className="w-5 h-5 text-gray-400" />
                </span>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  className="w-full py-2 pl-10 pr-10 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="********"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3"
                >
                  {showPassword ? (
                    <FiEyeOff className="w-5 h-5 text-gray-500" />
                  ) : (
                    <FiEye className="w-5 h-5 text-gray-500" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password Input */}
            <div>
              <label htmlFor="confirm-password" className="text-sm font-medium text-gray-700">
                Confirm New Password
              </label>
              <div className="relative mt-1">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                  <FiLock className="w-5 h-5 text-gray-400" />
                </span>
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  className="w-full py-2 pl-10 pr-10 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="********"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3"
                >
                  {showConfirmPassword ? (
                    <FiEyeOff className="w-5 h-5 text-gray-500" />
                  ) : (
                    <FiEye className="w-5 h-5 text-gray-500" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={isResettingPassword}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black
                           disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isResettingPassword ? 'Resetting...' : 'Set New Password'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  )
}

export default password