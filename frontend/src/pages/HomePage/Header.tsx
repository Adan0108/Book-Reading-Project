import React from 'react'
import { FiSearch, FiMenu } from 'react-icons/fi'
import { FaFire } from "react-icons/fa";

interface HeaderProps {
  onStartTour: () => void; // A function that returns nothing
}

const Header = ({ onStartTour }: HeaderProps) => {
  return (
    <header className = "sticky top-0 z-50 bg-gray-800 dark:bg-gray-950 text-white shadow-md">
      <div className = "container mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">

        {/* Logo Section */}
        <div className="flex items-center gap-4">
          {/* Logo */}
          <a href="/" className="flex-shrink-0">
            <img
              className="h-20 w-auto"
              src="/Name.svg" 
              alt="MANGA-SITE Logo"
            />
          </a>

          {/* Start Tour Button */}
          <button
            onClick={onStartTour}
            className="bg-yellow-500 text-gray-900 px-3 py-1 rounded-md text-sm font-medium hover:bg-yellow-400"
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
            className="w-full py-2 px-4 rounded-full bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />
          <button className ="absolute right-0 top-0 mt-3 mr-3">
            <FiSearch className ="text-gray-400" />
          </button>
        </div>

        {/* Navigation & Auth */}
        <nav className ="flex items-center gap-4">
          <a href="#" className="hidden md:block hover:text-yellow-400">Nổi bật </a>
          <a href="#" className="hidden md:block hover:text-yellow-400">Mới nhất</a>
          <a href="#" className="hidden md:block hover:text-yellow-400">Thể loại</a>
          <a href='/login' className ="bg-yellow-500 text-gray-900 px-3 py-1 rounded-md text-sm font-medium hover:bg-yellow-400">
            Đăng nhập
          </a>
          <button className="md:hidden text-2xl">
            <FiMenu />
          </button>
        </nav>
      </div>

      {/* Mobile Search Bar - Shown only on small screens */}
      <div className = "md:hidden px-4 pb-3">
        <div className = "relative w-full">
          <input
            type="text"
            placeholder="Search comics..."
            className="w-full py-2 px-4 rounded-full bg-gray-700 text-white placeholder-gray-400 focus:outline-none"
          />
          <button className="absolute right-0 top-0 mt-3 mr-3">
            <FiSearch className="text-gray-400" />
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header