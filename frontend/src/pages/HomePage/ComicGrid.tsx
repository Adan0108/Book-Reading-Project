import React, { useRef, useState } from 'react'
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation } from 'swiper/modules';
import ComicCard, { type ChapterInfo } from './ComicCard'

// --- Icons ---
const ChevronLeft = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
);

const ChevronRight = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

// --- Constants ---
const ITEMS_PER_PAGE = 6; 
const mockComics = generateComics();

// Helper to split array into chunks (pages)
function chunkArray<T>(array: T[], size: number): T[][] {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

interface ComicGridProps {
  title: string;
}

const ComicGrid = ({ title }: ComicGridProps) => {

  // 1. Create chunks (pages) of comics
  const comicPages = chunkArray(mockComics, ITEMS_PER_PAGE);

  // 2. Refs for custom navigation buttons
  const prevRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const [isBeginning, setIsBeginning] = useState(true);
  const [isEnd, setIsEnd] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 min-h-[600px] flex flex-col relative ">
      
      {/* --- HEADER --- */}
      <div className="flex items-center justify-between mb-6 border-b border-gray-100 dark:border-gray-700 pb-2">
        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white uppercase flex items-center gap-2">
           <span className="text-yellow-500 text-3xl">❖</span> {title}
        </h2>

        {/* Right Side: Link + Navigation Buttons */}
        <div className="flex items-center gap-3">
          <a href="#" className="text-sm text-gray-500 hover:text-yellow-500 transition-colors hidden sm:block">
            Xem tất cả
          </a>

          {/* Custom Navigation Buttons (Circles) */}
          <div className="flex items-center gap-2">
            <button
              ref={prevRef}
              className="w-8 h-8 rounded-full border border-gray-300 dark:border-gray-600 flex items-center justify-center transition-all hover:bg-yellow-500 hover:text-white hover:border-yellow-500 text-gray-600 dark:text-gray-300 cursor-pointer active:scale-95"
            >
              <ChevronLeft />
            </button>

            <button
              ref={nextRef}
              className="w-8 h-8 rounded-full border border-gray-300 dark:border-gray-600 flex items-center justify-center transition-all hover:bg-yellow-500 hover:text-white hover:border-yellow-500 text-gray-600 dark:text-gray-300 cursor-pointer active:scale-95"
            >
              <ChevronRight />
            </button>

          </div>
        </div>
      </div>

      {/* --- SWIPER GRID --- */}
      <Swiper
        modules={[Navigation]}
        spaceBetween={20}
        slidesPerView={1}
        allowTouchMove={true} // Optional: Set to true if you want drag support
        speed={500} // Smooth slide speed
        loop={true}
        navigation={{
          prevEl: prevRef.current,
          nextEl: nextRef.current,
        }}
        onBeforeInit={(swiper) => {
          // Bind refs to Swiper before it initializes
          if (typeof swiper.params.navigation !== 'boolean') {
            const nav = swiper.params.navigation;
            if (nav) {
                nav.prevEl = prevRef.current;
                nav.nextEl = nextRef.current;
            }
          }
        }}
        onSlideChange={(swiper) => {
          setIsBeginning(swiper.isBeginning);
          setIsEnd(swiper.isEnd);
        }}
        className="w-full flex-grow"
      >
        {comicPages.map((pageComics, pageIndex) => (
          <SwiperSlide key={pageIndex}>
            {/* The Grid Layout for this specific 'Page' */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full content-start">
              {pageComics.map((comic) => (
                <ComicCard
                  key={comic.id}
                  title={comic.title}
                  imageUrl={comic.imageUrl}
                  rating={comic.rating}
                  viewCount={comic.viewCount}
                  chapters={comic.chapters}
                  isHot={comic.isHot}
                />
              ))}
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
      
    </div>
  )
}

// Mock Data Generation
function generateComics() {
  const comics = [];
  for (let i = 1; i <= 100; i++) {
    const chapNum = 200 - i;
    const chapters: ChapterInfo[] = [
      { id: `c1-${i}`, name: `Chapter ${chapNum}`, time: '30 phút trước', url: '#' },
      { id: `c2-${i}`, name: `Chapter ${chapNum - 1}`, time: '1 ngày trước', url: '#' },
      { id: `c3-${i}`, name: `Chapter ${chapNum - 2}`, time: '2 ngày trước', url: '#' },
    ];

    comics.push({
      id: i,
      title: `Ta Là Tà Đế Bá Đạo Nhất Hệ Mặt Trời ${i}`,
      imageUrl: `https://www.artedguru.com/uploads/3/0/6/1/30613521/spiderman_orig.jpg`,
      rating: parseFloat((3 + Math.random() * 2).toFixed(1)),
      viewCount: `${(Math.random() * 100).toFixed(1)}K`,
      chapters: chapters,
      isHot: Math.random() > 0.8 
    });
  }
  return comics;
}

export default ComicGrid