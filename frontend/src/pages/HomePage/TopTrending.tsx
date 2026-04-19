import React, { useRef } from 'react'
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation } from 'swiper/modules';
import { useThemeStore } from '@/store/useThemeStore';
import ComicCard, {type ChapterInfo } from './ComicCard';

const ChevronLeft = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
);

const ChevronRight = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

const TopTrending = () => {
  const prevRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const { isDark } = useThemeStore();
  
  const trendingComics = generateTrendingData().slice(0, 7);

  const getRankColor = (index: number) => {
    switch (index) {
      case 0: return 'text-yellow-500 border-yellow-500 bg-yellow-500';
      case 1: return 'text-green-500 border-green-500 bg-green-500';  
      case 2: return 'text-blue-500 border-blue-500 bg-blue-500';    
      default: return 'text-gray-400 border-gray-400 bg-gray-400';    
    }
  };

  const themeClass = isDark 
    ? "text-[#60A5FA]"   // Dark Mode Style
    : "text-[#EA580C]"; // Light Mode Style

  return (
    <div className="w-full mb-10">
      
      {/* HEADER */}
      <div className={`flex items-end justify-between mb-2 pb-2 border-b-2 ${isDark ? "border-cyan-500" : "border-black-300"}`}>
        <div>
            <h2 className="text-2xl font-bold uppercase flex items-center gap-2">
                <span className= {`${themeClass} text-3xl font-black tracking-tighter drop-shadow-sm`}>
                  TOP THỊNH HÀNH
                </span>
            </h2>
            <p className={`${isDark ? "text-[#F8FAFC]" : "text-[#4B5563]"} text-lg mt-1 font-bold`}>
              Top 7 truyện được xem nhiều nhất tuần qua.
            </p>
        </div>

        {/* BUTTONS */}
        <div className="flex items-center gap-2">
            <button
                ref={prevRef}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-md border hover:bg-red-600 hover:text-white hover:border-red-600 active:scale-95 ${
                    isDark 
                        ? 'bg-gray-700 text-white border-gray-600' 
                        : 'bg-white text-gray-900 border-gray-200'
                }`}
            >
              <ChevronLeft />
            </button>
            <button
                ref={nextRef}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-md border hover:bg-red-600 hover:text-white hover:border-red-600 active:scale-95 ${
                    isDark 
                        ? 'bg-gray-700 text-white border-gray-600' 
                        : 'bg-white text-gray-900 border-gray-200'
                }`}
            >
              <ChevronRight />
            </button>
        </div>
      </div>

      {/* SLIDER */}
      <Swiper
        modules={[Navigation]}
        spaceBetween={30} 
        grabCursor={true}
        loop={true}
        navigation={{
          prevEl: prevRef.current,
          nextEl: nextRef.current,
        }}
        onBeforeInit={(swiper) => {
             if (typeof swiper.params.navigation !== 'boolean') {
                const nav = swiper.params.navigation;
                if (nav) {
                    nav.prevEl = prevRef.current;
                    nav.nextEl = nextRef.current;
                }
             }
        }}
        breakpoints={{
          0: {    slidesPerView: 1.2 },
          640: {  slidesPerView: 1.5 },
          1024: { slidesPerView: 3.5 }, 
          1280: { slidesPerView: 2.75 }
        }}
        className="w-full py-4 px-4 "
      >
        {trendingComics.map((comic, index) => {
          
          let strokeColor = '#9ca3af'; // Default gray
          let hoverTextClass = 'group-hover:text-gray-400';
          let decorationColor = 'bg-gray-400';

          if (index === 0) {
             strokeColor = '#eab308'; // Yellow hex
             hoverTextClass = 'group-hover:text-yellow-500'; // Explicit class
             decorationColor = 'bg-yellow-500';
          } else if (index === 1) {
             strokeColor = '#22c55e'; // Green hex
             hoverTextClass = 'group-hover:text-green-500'; // Explicit class
             decorationColor = 'bg-green-500';
          } else if (index === 2) {
             strokeColor = '#3b82f6'; // Blue hex
             hoverTextClass = 'group-hover:text-blue-500'; // Explicit class
             decorationColor = 'bg-blue-500';
          }

          return (
            <SwiperSlide key={comic.id}> 
              
              {/* WRAPPER STRATEGY: 
                 1. pt-16: Pushes the Comic Card down by 64px.
                 2. Number is absolute at top-0.
                 Result: Number sits at the very top edge (safe), Card sits below it.
              */}
              <div className="relative group ml-12 select-none pt-16"> 
                  
                  {/* --- 1. BIG NUMBER (BEHIND) --- */}
                  <div 
                      className={`
                        absolute top-0 -left-12 z-0 
                        font-black text-[8rem] leading-none 
                        transition-colors duration-300
                        text-transparent 
                        ${hoverTextClass}
                      `}
                      style={{ 
                          fontFamily: 'Arial, sans-serif',
                          WebkitTextStroke: `2px ${strokeColor}`,
                      }}
                  >
                      {index + 1}
                  </div>

                  {/* --- 2. DECORATIVE LINE (ABOVE) --- */}
                  {/* Adjusted top position relative to the pushed-down card */}
                  <div className={`absolute top-14 left-12 w-20 h-0.5 rounded-full z-20 ${decorationColor}`}></div>


                  {/* --- 3. CARD (FRONT) --- */}
                  <div className= {`relative z-10 shadow-sm hover:shadow-xl rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} `}>
                      <ComicCard
                          title={comic.title}
                          imageUrl={comic.imageUrl}
                          rating={comic.rating}
                          viewCount={comic.viewCount}
                          chapters={comic.chapters}
                          isHot={true} 
                          variant="default" 
                      />
                  </div>

              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  )
}

function generateTrendingData() {
  const comics = [];
  for (let i = 1; i <= 10; i++) {
    const chapNum = 400 - (i * 10);
    comics.push({
      id: i,
      title: i === 1 ? "Chàng Rể Mạnh Nhất Lịch Sử" : (i === 2 ? "Zombie No Afureta Sekai..." : `Top Trending Comic ${i}`),
      imageUrl: `https://watchmojo.blog/wp-content/uploads/2018/01/TheIncredibleHulk340.jpg`,
      rating: 4.6,
      viewCount: `${(20 - i).toFixed(1)}M`,
      chapters: [
        { id: `t1-${i}`, name: `Chapter ${chapNum}`, time: '2 ngày trước', url: '#' },
        { id: `t2-${i}`, name: `Chapter ${chapNum - 1}`, time: '2 ngày trước', url: '#' },
      ],
    });
  }
  return comics;
}

export default TopTrending