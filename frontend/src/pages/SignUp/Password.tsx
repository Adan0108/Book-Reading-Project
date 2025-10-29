import React, {useState} from 'react'
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiUser, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';

const Password = () => {

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const navigate = useNavigate();
  const email = "quang1452000@gmail.com";

  const handleBack = () => {
    navigate('/otp');
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
      // Prevent the browser from doing a full-page reload
      event.preventDefault(); 
      
      console.log('Email-only form submitted!');
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
        <div className = "w-full max-w-md pt-1 px-8 pb-8 bg-white rounded-xl shadow-lg">

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
          
          {/* Showing email */}
          <div className = "flex justify-center mb-2">
            <div className = "px-4 py-2 text-sm text-gray-700 bg-gray-100 border border-gray-300 rounded-full">
              {email}
            </div>
          </div>

          <div className = "text-center">
            <h2 className = "text-2xl font-bold">Complete your profile</h2>
            <p className="mt-1 text-gray-500">Setup user name and password</p>
          </div>

          <form className = "space-y-6 mt-2" onSubmit={handleSubmit}>
            {/* Username Input */}
            <div>
              <label htmlFor="username" className="text-sm font-medium text-gray-700">
                Username
              </label>

              <div className = "relative mt-1">
                <span className = "absolute inset-y-0 left-0 flex items-center pl-3">
                  <FiUser className="w-5 h-5 text-gray-400" />
                </span>

                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  className="w-full py-2 pl-10 pr-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Eg: user_name"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="text-sm font-medium text-gray-700">
                Password
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
                Confirm Password
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

            {/* Create Account Button */}
            <div className = "mt-8">
              <button
                type="submit"
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black"
              >
                Submit
              </button>
            </div>
            
          </form>
        </div>
      </div>
    </div>
  )
}

export default Password