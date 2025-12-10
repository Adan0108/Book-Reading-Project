import React, { useState, useEffect } from 'react';
import OtpInput from 'react-otp-input';
import { FiArrowLeft } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import type { AuthState } from '../../type/store';

const OTP = () => {

  const [otp, setOtp] = useState('');
  const [countdown, setCountdown] = useState(60);
  const navigate = useNavigate();

  const verifyOtp = useAuthStore((state: AuthState) => state.verifyOtp);
  const isVerifying = useAuthStore((state: AuthState) => state.isVerifying);
  const emailToVerify = useAuthStore((state: AuthState) => state.emailToVerify);
  const resendOtp = useAuthStore((state: AuthState) => state.resendOtp); 
  const isResending = useAuthStore((state: AuthState) => state.isResending); 

  const handleBack = () => {
    navigate('/signup');
  }

  const handleResend = async () => {
    await resendOtp();
    setCountdown(60);
  }

  // Automatic navigation when OTP is complete
  useEffect(() => {
    if (otp.length === 6) {
      const handleVerification = async () => {
        const success = await verifyOtp(otp);
        
        if (success) {
          // It worked! Go to the Password page
          navigate('/setPassword'); // <-- This is the next step
        } else {
          // It failed, clear the OTP so the user can try again
          setOtp('');
        }
      };

      handleVerification();
    }

  }, [otp, verifyOtp, navigate]);

  // Countdown timer for resending OTP
  useEffect(() => {
    // If countdown is 0, don't do anything
    if (countdown === 0) return;

    // Start an interval that ticks down every second
    const intervalId = setInterval(() => {
      setCountdown((prevCountdown) => prevCountdown - 1);
    }, 1000);

    // This is a cleanup function.
    // It clears the interval if the component unmounts or the countdown changes.
    return () => clearInterval(intervalId);
    
  }, [countdown]);

  return (

    <div 
      className = "flex items-center justify-center min-h-screen bg-gray-50"
      style={{
        backgroundImage: `url('/background.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >

      <div className = "w-full max-w-md p-8 pt-0 bg-white rounded-lg shadow-md">

        <div className = "relative flex justify-center items-center">

          {/* Back Button */}
          <button onClick= {handleBack} className = 'absolute left-0 text-gray-500 hover:text-gray-800'>
            <FiArrowLeft size= {24} />
          </button>

          <div className = "flex justify-center">
            <img
              // CHANGED: Adjust 'h-8' (32px) to your logo's size
              className="h-30 w-auto" 
              // CHANGED: Make sure this 'src' matches your file in the /public folder
              src="/Name.svg"       
              alt="Your Logo" 
            />
          </div>
        </div>

        {/* OTP Instruction */}
        <div className = "flex flex-col items-center">
          
          <div className="flex justify-center mb-6">
            <div className="px-4 py-2 text-sm text-gray-700 bg-gray-100 border border-gray-300 rounded-full">
              {emailToVerify || 'your-email@example.com'}
            </div>
          </div>
          
          <h1 className = "text-2xl font-bold text-gray-900 mb-2">
            Verify your email
          </h1>
          <p className="text-gray-600 text-center mb-8">
            Enter the code we sent to your email address.
          </p>

          {/* OTP Input */}
          <div className = "mb-6">
            <OtpInput
              value = {otp}
              onChange = {setOtp}
              numInputs= {6}
              renderSeparator= {<span className="w-2" />}
              renderInput={(props) => (
                <input
                  {...props}
                  style = {{}}
                  disabled={isVerifying}
                  className="!w-12 !h-14 sm:!w-12 sm:!h-12 font-bold text-center text-2xl border border-gray-300 rounded-md 
                             focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600
                             transition-all"
                />
              )}
            />
          </div>

          <button
            onClick={handleResend}
            disabled={isVerifying || isResending || countdown > 0}
            className = "font-medium text-blue-600 hover:text-blue-500 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            {isResending ? (
              'Sending code...'
            ) : countdown > 0 ? (
              `Resend code (${countdown}s)`
            ) : (
              'Resend code'
            )}
          </button>

        </div>
      </div>
    </div>
  )
}

export default OTP