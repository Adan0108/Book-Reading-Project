import React from 'react';
import { FiMail, FiArrowLeft } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import type { AuthState } from '../../type/store';
import { toast } from 'sonner';

const email = () => {

    const navigate = useNavigate();

    const forgotPassword = useAuthStore((state: AuthState) => state.forgotPassword);
    const isRequestingReset = useAuthStore((state: AuthState) => state.isRequestingReset);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const formData = new FormData(event.currentTarget);
        const email = formData.get('email') as string;

        if (!email) {
            toast.error("Please enter an email.");
            return;
        }

        console.log('Forgot Password form submitted!');
    
        const success = await forgotPassword(email);

        if (success) {
            navigate('/forgot/changePassword');
        }
    };

    const handleBack = () => {
        navigate('/login'); // Go back to the login page
    };

    return (
        <div
            className = "flex items-start justify-center min-h-screen bg-gray-100 p-4 pt-30"
            style={{
                backgroundImage: `url('/background.jpg')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            }}
        >
            <div className = "flex flex-col items-center justify-center w-full max-w-4xl px-4">
                
                {/* Padding for the card */}
                <div className = "w-full max-w-md pt-1 px-8 pb-8 bg-white rounded-xl shadow-lg">

                    {/* Header with Back Arrow and Logo */}
                    <div className = "relative flex justify-center items-center">
                        <button
                            onClick={handleBack}
                            className = "absolute left-0 text-gray-500 hover:text-gray-800"
                        >
                            <FiArrowLeft size={24} />
                        </button>
                        <div className = "flex justify-center">
                            <img
                                className = "h-40 w-auto"
                                src = "/Name.svg"
                                alt="MeoMic Logo"
                            />
                        </div>
                    </div>

                    {/* Titles */}
                    <div className = "text-center">
                        <h2 className = "text-2xl font-bold">Forgot Password?</h2>
                        <p className = "mt-1 text-gray-500">Enter your email</p>
                    </div>

                    {/* Form */}
                    <form className = "space-y-6 mt-6" onSubmit={handleSubmit}>

                        {/* Email Input */}
                        <div>
                            <label htmlFor="email" className="text-sm font-medium text-gray-700">
                                Email Address
                            </label>

                            <div className = "relative mt-1">
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

                        {/* Submit Button */}
                        <div>
                            <button
                                type="submit"
                                disabled={isRequestingReset}
                                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black
                                        disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                {isRequestingReset ? 'Sending...' : 'Send OTP'}
                            </button>
                        </div>
                    </form>

                </div>
            </div>
        </div>
    )
}

export default email