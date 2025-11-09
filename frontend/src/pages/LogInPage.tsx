import React, {useState} from "react"
import { FiMail, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from "../store/useAuthStore";
import type { AuthState } from "../type/store";


const LoginPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const login = useAuthStore((state: AuthState) => state.login);
  const isLoggingIn = useAuthStore((state: AuthState) => state.isLoggingIn);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!email || !password) {
      toast.error("Please enter both email and password.");
      return;
    }

    const success = await login(email, password);

    if (success) {
      navigate('/');
    }
  };

  return (
    <div
      className="flex items-center justify-center min-h-screen bg-gray-100"
      style={{
        backgroundImage: `url('/background.jpg')`, // Accessing from the 'public' folder
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="flex flex-col items-center justify-center w-full max-w-4xl px-4">

        {/* Top section: Logo and Welcome Text */}
        <div className="text-center mb-4 text-white mt-3">
          <h1 className="text-4xl font-bold tracking-tight">WELCOME TO 50/50 TEAM</h1>
        </div>

        {/* Sign-in Card */}
        <div className = "w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg">
          <div className = "text-center">
            <h2 className="text-2xl font-bold">Sign In</h2>
            <p className = "mt-1 text-gray-500">Enter your credentials to access your account</p>
          </div>

          <form className = "space-y-6" onSubmit={handleSubmit}>
            {/* Email Input */}
            <div>
              <label htmlFor = "email" className = "text-sm font-medium text-gray-700"> Email </label>
              <div className = "relative mt-1">
                <span className = "absolute inset-y-0 left-0 flex items-center pl-3">
                  <FiMail className = "w-5 h-5 text-gray-400" />
                </span>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="w-full py-2 pl-10 pr-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="@example.com"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor = "password" className = "text-sm font-medium text-gray-700"> Password </label>
              <div className = "relative mt-1">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                  <FiLock className="w-5 h-5 text-gray-400" />
                </span>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
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

            {/* Remember Me & Forgot Password */}
            <div className = "flex items-center justify-between">
              <div className = "flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                  Remember me
                </label>
              </div>
              <div className = "text-sm">
                <a href="/forgot/email" className="font-medium text-indigo-600 hover:text-indigo-500">
                  Forgot Password?
                </a>
              </div>
            </div>

            {/* Sign In Button */}
            <div>
              <button
                type = "submit"
                disabled={isLoggingIn}
                className = "w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black"
              >
                {isLoggingIn ? 'Signing In...' : 'Sign In'}
              </button>
            </div>
          </form>

          {/* Separator */}
          <div className = "relative flex items-center justify-center">
            <div className = "flex-grow border-t border-gray-300"></div>
            <span className = "flex-shrink mx-4 text-sm text-gray-400">OR</span>
            <div className = "flex-grow border-t border-gray-300"></div>
          </div>

          {/* Sign Up Link */}
          <p className="text-sm text-center text-gray-600">
            Don't have an account?{' '}
            <a href="/signup" className="font-medium text-indigo-600 hover:text-indigo-500">
              Sign up
            </a>
          </p>

        </div>
      
      </div>
    
    </div>
  )
}

export default LoginPage