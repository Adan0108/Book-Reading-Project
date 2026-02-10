import React from 'react'

export interface ChapterInfo {
  id: string;
  name: string;
  time: string;
  url: string;
}

interface ComicCardProps {
  title: string;
  imageUrl: string;
  rating: number;     // e.g., 4.5
  viewCount: string;  // e.g., "13M"
  chapters: ChapterInfo[]; // Array of recent chapters
  isHot?: boolean;
  variant?: 'default' | 'trending';
}

const ComicCard = ({ title, imageUrl, rating, viewCount, chapters, isHot = false, variant = 'default' }: ComicCardProps) => {
  
  // Render Stars Based on Rating
  const renderStars = (rate: number) => {
    return (
      <div className="flex items-center space-x-0.5 text-yellow-400">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg key={star} className={`w-3 h-3 ${star <= rate ? 'fill-current' : 'text-gray-300 dark:text-gray-600'}`} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
        <span className="text-xs text-gray-500 dark:text-gray-400 ml-1 font-medium">{rate}</span>
      </div>
    );
  };

  const isTrending = variant === 'trending';

  // Customise here
  const containerClass = isTrending
    ? "group flex flex-row bg-transparent text-gray-100 h-40 sm:h-48 overflow-visible"
    : "group flex flex-row bg-gray-100 dark:bg-gray-800/50 rounded-lg overflow-hidden h-40 sm:h-48 shadow-sm hover:shadow-md transition-shadow border border-gray-400 dark:border-blue-900";

  return (
    <div className= {containerClass}>
      
      {/* 1. Left Side: Image (Fixed Width) */}
      <a href='#' className = "relative block w-28 sm:w-36 flex-shrink-0 overflow-hidden">
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      </a>

      {/* 2. Right Side: Information */}
      <div className = "flex flex-col flex-grow p-3 sm:p-4 min-w-0">

        {/* Title */}
        <a
          href="#" 
          className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100 hover:text-yellow-500 line-clamp-1 sm:line-clamp-2 leading-tight mb-2 transition-colors"
          title={title}
        >
          {title}
        </a>

        {/* Rating & Views Row */}
        <div className="flex flex-wrap items-center gap-3 mb-3 text-xs">
          {renderStars(rating)}
          <span className="text-gray-300 dark:text-gray-600 hidden sm:inline">•</span>
          <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-[10px] sm:text-[11px] font-medium border border-gray-200 dark:border-gray-600">
            {viewCount} lượt xem
          </span>
        </div>

        {/* Chapters List */}
        <div className = "mt-auto space-y-1">
          {chapters.slice(0, 3).map((chap) => (
            <div key={chap.id} className="flex items-center justify-between text-xs sm:text-sm" >
              <a href={chap.url} className="font-medium text-gray-700 dark:text-gray-300 hover:text-yellow-500 truncate mr-2">
                {chap.name}
              </a>
              <span className="text-gray-400 text-[11px] whitespace-nowrap italic hidden sm:block">
                {chap.time}
              </span>

              {/* Mobile Only Time (Simpler) */}
              <span className="text-gray-400 text-[10px] whitespace-nowrap italic sm:hidden">
                {chap.time.replace(' trước', '')}
              </span>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}

export default ComicCard