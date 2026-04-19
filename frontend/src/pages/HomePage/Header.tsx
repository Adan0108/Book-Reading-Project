import React, { useState, useEffect, useRef } from 'react';
import { FiSearch, FiMenu, FiSun, FiMoon, FiLoader, FiUser, FiSettings, FiLogOut, FiBookOpen } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import type { AuthState } from '../../type/store';
import { useAuthStore } from '../../store/useAuthStore';
import { useThemeStore } from '@/store/useThemeStore';
import { bookService } from '../../services/bookService'; // <-- Import your service
import type { Book } from '../../type/book';

interface HeaderProps {
  onStartTour: () => void;
}

// 1. Extracted SearchBar component to reuse for both Desktop and Mobile
const SearchBar = ({ isDark }: { isDark: boolean }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Book[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  
  const wrapperRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced API Call
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.trim()) {
        setIsSearching(true);
        try {
          const response = await bookService.getBooks({ query, limit: 5 });
          const fetchedBooks = response.metadata?.items || [];
          setResults(fetchedBooks);
          setShowDropdown(true);
          
        } catch (error) {
          console.error("Search error:", error);
        } finally {
          setIsSearching(false);
        }
      } else {
        setResults([]);
        setShowDropdown(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="text"
        placeholder="Tìm truyện..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => { if (query.trim()) setShowDropdown(true); }}
        className={`w-full py-2 px-4 pr-10 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500
          ${isDark 
              ? "bg-gray-800/80 text-white placeholder-gray-400" 
              : "bg-gray-200 text-gray-900 placeholder-gray-500"
          }`}
      />
      <button className="absolute right-0 top-0 mt-2.5 mr-4">
        {isSearching ? (
           <FiLoader className={`animate-spin ${isDark ? "text-gray-400" : "text-gray-500"}`} />
        ) : (
           <FiSearch className={isDark ? "text-gray-400 text-lg" : "text-gray-500 text-lg"} />
        )}
      </button>

      {/* Live Search Dropdown */}
      {showDropdown && results.length > 0 && (
        <div className={`absolute top-full left-0 right-0 mt-2 rounded-lg shadow-lg overflow-hidden z-50 border
          ${isDark ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-200 text-gray-900"}`}
        >
          {results.map((book) => (
            <div 
              key={book.id}
              onClick={() => {
                setShowDropdown(false);
                setQuery('');
                navigate(`/comic/${book.slug}`);
              }}
              className={`flex items-center gap-3 p-3 cursor-pointer transition-colors
                ${isDark ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
            >
              <img 
                src={book.coverUrl || 'https://stock.adobe.com/search?k=no+image+available'} 
                alt={book.title} 
                className="w-10 h-14 object-cover rounded" 
              />

              <div className="flex flex-col flex-1 min-w-0">
                <span className="font-semibold truncate">{book.title}</span>
                <span className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  {book.authorName} • {book.totalChapters} Chương
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Empty State for Dropdown */}
      {showDropdown && query.trim() && results.length === 0 && !isSearching && (
        <div className={`absolute top-full left-0 right-0 mt-2 p-4 text-center rounded-lg shadow-lg z-50 border
          ${isDark ? "bg-gray-800 border-gray-700 text-gray-400" : "bg-white border-gray-200 text-gray-500"}`}
        >
          Không tìm thấy truyện nào.
        </div>
      )}
    </div>
  );
};

const Header = ({ onStartTour }: HeaderProps) => {
  const navigate = useNavigate();
  const logout = useAuthStore((state: AuthState) => state.logout);
  const authUser = useAuthStore((state: AuthState) => state.authUser);
  const { isDark, toggleTheme } = useThemeStore();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const headerBaseClass = "sticky top-0 z-50 transition-all duration-300 backdrop-blur-md shadow-sm border-b";
  const themeClass = isDark 
    ? "bg-blue-950/75 border-white/10 text-white"   
    : "bg-white/75 border-gray-200/50 text-gray-900"; 

  return (
    <header className={`${headerBaseClass} ${themeClass}`}>
      <div className="container mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">

        {/* Logo Section */}
        <div className="flex items-center gap-10">
          <a href="/" className="flex-shrink-0">
            <img
              className={`h-20 w-auto transition-all ${isDark ? 'brightness-0 invert' : ''}`}
              src="/Name.svg" 
              alt="MeoMic Logo"
            />
          </a>

          <button
            onClick={onStartTour}
            className="bg-yellow-500 text-gray-900 px-3 py-1 rounded-md text-sm font-bold hover:bg-yellow-400 shadow-sm transition-transform active:scale-95"
          >
            Start Tour
          </button>
        </div>

        {/* Desktop Search Bar */}
        <div className="hidden md:flex relative w-full max-w-lg mx-4">
          <SearchBar isDark={isDark} />
        </div>

        {/* Navigation & Auth */}
        <nav className="flex items-center gap-4 font-medium">
          <a href="#" className={`hidden md:block transition-colors ${isDark ? "hover:text-yellow-400" : "hover:text-yellow-600"}`}>Nổi bật</a>
          <a href="#" className={`hidden md:block transition-colors ${isDark ? "hover:text-yellow-400" : "hover:text-yellow-600"}`}>Mới nhất</a>
          <a href="#" className={`hidden md:block transition-colors ${isDark ? "hover:text-yellow-400" : "hover:text-yellow-600"}`}>Thể loại</a>

          <button
            onClick={toggleTheme}
            className={`p-2 rounded-full transition-colors text-xl ${isDark ? "hover:bg-white/10" : "hover:bg-gray-200/50"}`}
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDark ? <FiSun className="text-yellow-400" /> : <FiMoon />}
          </button>
          
          {/* 3. The New User Menu Dropdown */}
          <div className= 'relative' ref= {userMenuRef}>
            {authUser ? (
              // Logged In: Show Avatar
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className= {`flex items-center justify-center w-9 h-9 rounded-full bg-yellow-500 text-gray-900 font-bold hover:ring-2 hover:ring-yellow-400 transition-all shadow-sm`}
              >
                {(authUser.username || authUser.email || 'U')[0].toUpperCase()}
              </button>
            ) : (
              // Logged Out: Show User Icon
              <button
                onClick= {() => setShowUserMenu(!showUserMenu)}
                className= {`p-2 rounded-full transition-colors text-xl ${isDark ? "hover:bg-white/10" : "hover:bg-gray-200/50"}`}
              >
                <FiUser />
              </button>
            )}

            {/* The Dropdown Panel */}
            {showUserMenu && (
              <div className={`absolute right-0 mt-3 w-56 rounded-xl shadow-xl overflow-hidden z-50 border
                ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
              >

                {authUser ? (
                  <>

                    <div className= {`p-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
                      <p className= "font-bold truncate">{authUser.username || authUser.email}</p>
                      <p className= {`text-xs mt-1 truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {authUser.email}
                      </p>
                    </div>

                    <div className="p-2">
                      <button onClick={() => { setShowUserMenu(false); navigate('/profile'); }} className={`w-full text-left px-3 py-2 text-sm rounded-lg flex items-center gap-3 transition-colors ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}>
                        <FiUser className="text-gray-400" /> Hồ sơ của tôi
                      </button>
                      <button onClick={() => { setShowUserMenu(false); navigate('/author/dashboard'); }} className={`w-full text-left px-3 py-2 text-sm rounded-lg flex items-center gap-3 transition-colors ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}>
                        <FiBookOpen className="text-gray-400" /> Quản lý truyện
                      </button>
                      <button onClick={() => { setShowUserMenu(false); navigate('/settings'); }} className={`w-full text-left px-3 py-2 text-sm rounded-lg flex items-center gap-3 transition-colors ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}>
                        <FiSettings className="text-gray-400" /> Cài đặt
                      </button>
                    </div>

                    <div className={`p-2 border-t ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
                      <button onClick={() => { setShowUserMenu(false); logout(); }} className="w-full text-left px-3 py-2 text-sm text-red-500 rounded-lg flex items-center gap-3 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10">
                        <FiLogOut /> Đăng xuất
                      </button>
                    </div>

                  </>
                ) : (
                  <div className= 'p-3'>
                    
                    <p className={`text-sm mb-3 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      Đăng nhập để lưu truyện và bình luận
                    </p>

                    <button onClick={() => { setShowUserMenu(false); navigate('/login'); }} className="w-full text-center px-4 py-2 mb-2 bg-yellow-500 text-gray-900 font-bold rounded-lg hover:bg-yellow-400 transition-colors">
                      Đăng Nhập
                    </button>

                    <button onClick={() => { setShowUserMenu(false); navigate('/register'); }} className={`w-full text-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'}`}>
                      Đăng Ký
                    </button>

                  </div>
                )}

              </div>
            )}
          </div>

          <button className="md:hidden text-2xl">
            <FiMenu />
          </button>
        </nav>
      </div>

      {/* Mobile Search Bar */}
      <div className="md:hidden px-4 pb-3">
        <SearchBar isDark={isDark} />
      </div>
    </header>
  );
};

export default Header;