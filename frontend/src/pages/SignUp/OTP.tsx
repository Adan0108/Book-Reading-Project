import React, { useState, useEffect } from 'react';
import OtpInput from 'react-otp-input';
import { FiArrowLeft } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

const OTP = () => {

  const [otp, setOtp] = useState('');
  const navigate = useNavigate();
  const email = "quang1452000au@gmail.com";

  const handleBack = () => {
    navigate('/signup');
  }

  // Automatic navigation when OTP is complete
  useEffect(() => {
    if (otp.length === 6){
      navigate('/setpassword');
    }
  }, [otp, navigate]);

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
          
          <div className = "px-4 py-2 mb-6 text-sm text-gray-700 bg-gray-100 border border-gray-300 rounded-full">
            {email}
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
                  className="!w-12 !h-14 sm:!w-12 sm:!h-12 font-bold text-center text-2xl border border-gray-300 rounded-md 
                             focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600
                             transition-all"
                />
              )}
            />
          </div>

          <button className = "font-medium text-blue-600 hover:text-blue-500">
            Resend code
          </button>

        </div>
      </div>
    </div>
  )
}

export default OTP