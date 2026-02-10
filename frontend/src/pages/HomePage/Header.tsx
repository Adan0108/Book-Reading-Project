import React from 'react'
import { FiSearch, FiMenu, FiSun, FiMoon } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom';
import type { AuthState } from '../../type/store';
import { useAuthStore } from '../../store/useAuthStore';
import { useThemeStore } from '@/store/useThemeStore';

interface HeaderProps {
  onStartTour: () => void; // A function that returns nothing
}

const Header = ({ onStartTour }: HeaderProps) => {

  const navigate = useNavigate();
  const logout = useAuthStore((state: AuthState) => state.logout);
  const authUser = useAuthStore((state: AuthState) => state.authUser);

  //Get the isDark boolean
  const { isDark, toggleTheme } = useThemeStore();

  //Define the styling logic based on isDark
  const headerBaseClass = "sticky top-0 z-50 transition-all duration-300 backdrop-blur-md shadow-sm border-b";
  
  //If Dark, use Black/60. If Light, use White/75.
  const themeClass = isDark 
    ? "bg-blue-950/75 border-white/10 text-white"   // Dark Mode Style
    : "bg-white/75 border-gray-200/50 text-gray-900"; // Light Mode Style

  return (
    <header className = {`${headerBaseClass} ${themeClass}`}>
      <div className = "container mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">

        {/* Logo Section */}
        <div className="flex items-center gap-10">
          {/* Logo */}
          <a href="/" className="flex-shrink-0">
            <img
              className={`h-20 w-auto transition-all ${isDark ? 'brightness-0 invert' : ''}`}
              src="/Name.svg" 
              alt="MANGA-SITE Logo"
            />
          </a>

          {/* Start Tour Button */}
          <button
            onClick={onStartTour}
            className="bg-yellow-500 text-gray-900 px-3 py-1 rounded-md text-sm font-bold hover:bg-yellow-400 shadow-sm transition-transform active:scale-95"
          >
            Start Tour
          </button>
        </div>

        {/* Search Bar */}
        <div className = "hidden md:flex relative w-full max-w-lg mx-4">
          <input
            id = "tour-search-bar"
            type="text"
            placeholder="Tìm truyện..."
            className={`w-full py-2 px-4 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500
              ${isDark 
                  ? "bg-gray-800/80 text-white placeholder-gray-400" 
                  : "bg-gray-300 text-gray-900 placeholder-gray-500"
              }`}
          />
          <button className ="absolute right-0 top-0 mt-3 mr-3">
            <FiSearch className = {isDark ? "text-gray-400 text-lg" : "text-gray-500 text-lg"} />
          </button>
        </div>

        {/* Navigation & Auth */}
        <nav className ="flex items-center gap-4 font-medium">
          <a href="#" className= {`hidden md:block transition-colors ${isDark ? "hover:text-yellow-400" : "hover:text-yellow-600"}`}>Nổi bật </a>
          <a href="#" className= {`hidden md:block transition-colors ${isDark ? "hover:text-yellow-400" : "hover:text-yellow-600"}`}>Mới nhất</a>
          <a href="#" className= {`hidden md:block transition-colors ${isDark ? "hover:text-yellow-400" : "hover:text-yellow-600"}`}>Thể loại</a>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className = {`p-2 rounded-full transition-colors text-xl ${isDark ? "hover:bg-white/10" : "hover:bg-gray-200/50"}`}
            title= {isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {/* Show Sun if Dark, Moon if Light */}
            {isDark ? <FiSun className="text-yellow-400" /> : <FiMoon />}
          </button>
          
          {authUser ? (
            <div className="flex items-center gap-3">
              <span className="hidden lg:block text-sm font-semibold truncate max-w-[100px]">
                Hi, {authUser.username || (authUser.email ? authUser.email.split('@')[0] : 'User')}
              </span>
              <button onClick={() => logout()} className="bg-red-600 text-white px-3 py-1 rounded-md text-sm font-medium hover:bg-red-500 shadow-sm">
                Logout
              </button>
            </div>
          ) : (
            <button onClick={() => navigate('/login')} className="bg-yellow-500 text-gray-900 px-4 py-1.5 rounded-md text-sm font-bold hover:bg-yellow-400 shadow-sm">
              Sign In
            </button>
          )}

          <button className="md:hidden text-2xl">
            <FiMenu />
          </button>
        </nav>
      </div>

      {/* Mobile Search Bar - Shown only on small screens */}
      <div className="md:hidden px-4 pb-3">
        <div className="relative w-full">
          <input
            type="text"
            placeholder="Search comics..."
            className={`w-full py-2 px-4 rounded-full focus:outline-none focus:ring-1 focus:ring-yellow-500
              ${isDark 
                  ? "bg-gray-800/80 text-white" 
                  : "bg-gray-100 text-gray-900"
              }`}
          />
          <button className="absolute right-0 top-0 mt-2.5 mr-4">
            <FiSearch className={isDark ? "text-gray-400" : "text-gray-500"} />
          </button>
        </div>
      </div>
      
    </header>
  )
}

export default Header