import React, { useState } from 'react';
import { FiMail } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { toast } from 'sonner';
import type { AuthState } from '../../type/store';


const SignUp = () => {

  const navigate = useNavigate();

  const signUp = useAuthStore((state: AuthState) => state.signUp);
  const isSigningUp = useAuthStore((state: AuthState) => state.isSigningUp);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    // Prevent the browser from doing a full-page reload
    event.preventDefault();
    
    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string

    if (!email) {
      toast.error("Please enter an email.");
      return;
    }
    
    console.log('Email form submitted!');

    // 4. Call the store function (which calls the service)
    const success = await signUp(email);

    // 5. Only navigate if the API call was successful
    if (success) {
      navigate('/OTP' , { state: { email } });
    }

  };
  
  return (
    <div
      className = "flex items-center justify-center min-h-screen bg-gray-100 p-4"
      style={{
        backgroundImage: `url('/background.jpg')`, // Accessing from the 'public' folder
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className = "flex flex-col items-center justify-center w-full max-w-4xl px-4">

        {/* Sign-up Card */}
        <div className = "w-full max-w-md px-8 py-4 space-y-2 bg-white rounded-xl shadow-lg">

          <div className = "relative flex justify-center items-center">
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

          <div className = "text-center">
            <h2 className="text-2xl font-bold">Create your account</h2>
            <p className="mt-1 text-gray-500">Enter your email address</p>
          </div>

          <form className= "space-y-6 mt-4" onSubmit={handleSubmit}>
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email
              </label>

              <div className = "relative mt-0.5">
                <span className = "absolute inset-y-0 left-0 flex items-center pl-3">
                  <FiMail className="w-5 h-5 text-gray-400" />
                </span>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="w-full py-2 pl-10 pr-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Eg: you@example.com"
                />
              </div>
            </div>


            {/* Create Account Button */}
            <div className = "mt-8">
              <button
                type="submit"
                disabled={isSigningUp}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isSigningUp ? 'Sending...' : 'Continue'}
              </button>
            </div>

          </form>

          {/* Separator */}
          <div className="relative flex items-center justify-center">
            <div className="flex-grow border-t border-gray-300"></div>
            <span className="flex-shrink mx-4 text-sm text-gray-400">Or</span>
            <div className="flex-grow border-t border-gray-300"></div>
          </div>

          {/* Sign In Link */}
          <p className="text-sm text-center text-gray-600">
            Already have an account?{' '}
            <a href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
              Sign in
            </a>
          </p>

        </div>
      </div>
    </div>
  )
}

export default SignUp