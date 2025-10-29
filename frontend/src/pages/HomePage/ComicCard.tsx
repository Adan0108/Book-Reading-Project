import React from 'react'

interface ComicCardProps {
  title: string;
  latestChapter: string;
  imageUrl: string;
}

const ComicCard = ({ title, latestChapter, imageUrl }: ComicCardProps) => {
  return (
    <div className = "group rounded-md overflow-hidden shadow-lg relative">
      <a href = '#' className = "block">
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-48 sm:h-56 md:h-64 object-cover transition-transform duration-300 group-hover:scale-105"
        />

        {/* Overlay for title and chapter */}
        <div className = "absolute bottom-0 left-0 right-0 p-2 bg-black bg-opacity-70 text-white">
          <h3 className="text-sm font-semibold truncate group-hover:text-yellow-400">
            {title}
          </h3>
          <p className="text-xs text-gray-300">
            {latestChapter}
          </p>
        </div>
      </a>
    </div>
  )
}

export default ComicCard