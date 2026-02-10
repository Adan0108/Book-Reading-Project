import React, { useEffect } from 'react'
import Header from './Header';
import Footer from './Footer';
import FeaturedSlider from './FeaturedSlider';
import ComicGrid from './ComicGrid';
import Sidebar from './Sidebar';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useAuthStore } from '../../store/useAuthStore';
import { useThemeStore } from '../../store/useThemeStore'; // Adjusted import path based on context
import TopTrending from './TopTrending';
import SideDecorations from './SideDecorations';

const driverObj = driver({
  showProgress: true,
  steps: [
    {
      element: '#tour-search-bar',
      popover: {
        title: 'Tìm Kiếm',
        description: 'Nhập tên truyện bạn muốn tìm vào đây.',
      }
    },
    { 
      element: '#tour-top-comics',
      popover: { 
        title: 'Bảng Xếp Hạng', 
        description: 'Xem top truyện được yêu thích nhất theo Ngày, Tuần, Tháng.' 
      } 
    },
    { 
      element: '#tour-comic-grid',
      popover: { 
        title: 'Truyện Mới', 
        description: 'Cập nhật các chương truyện mới nhất vừa ra lò.' 
      } 
    },
  ]
})

const HomePage = () => {

  const checkAuth = useAuthStore((state) => state.refreshToken);
  const { isDark } = useThemeStore();

  // Fallback colors if images don't load
  const backgroundImage = isDark 
                          ? { backgroundColor: '#111827' }
                          : { backgroundColor: '#dfe1e6' };

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Wrapper function to start tour
  const handleStartTour = () => {
    driverObj.drive();
  };

  return (
    <div 
      className="min-h-screen text-gray-900 dark:text-gray-100 transition-all duration-500 flex flex-col"
      style={{
        ...backgroundImage,
        backgroundSize: 'cover',
        backgroundPosition: 'top center',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <SideDecorations />

      <Header onStartTour={handleStartTour} />

      {/* Featured Slider - Full width container */}
      <div className="w-full mb-8">
        <FeaturedSlider />
      </div>

      {/* Main Content Area */}
      <main className="container mx-auto max-w-7xl px-4 pb-12 flex-grow">

        <TopTrending />
        
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Main Column (Latest Updates) - Takes up approx 70% space on large screens */}
          <div className="w-full lg:w-[70%]">
            <ComicGrid title="Mới Cập Nhật" />
          </div>

          {/* Sidebar (Top Follows) - Takes up approx 30% space on large screens */}
          <aside className="w-full lg:w-[30%]">
             {/* Sticky wrapper ensures sidebar stays in view if content is long */}
             <div className="sticky top-4">
                <Sidebar />
             </div>
          </aside>
          
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default HomePage