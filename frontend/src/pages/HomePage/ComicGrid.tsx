import React, { useState } from 'react'
import ComicCard  from './ComicCard'
import Pagination from '../../components/Pagination';

const mockComics = generateComics();

const ITEMS_PER_PAGE = 10;

interface ComicGridProps {
  title: string;
}

const ComicGrid = ({ title }: ComicGridProps) => {

  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(mockComics.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentComics = mockComics.slice(startIndex, endIndex);

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  return (
    <div className = "bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
      <h2 className = "text-2xl font-bold mb-4 border-l-4 border-yellow-500 pl-2">
        {title}
      </h2>

      <div id = "tour-comic-grid" className = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {currentComics.map((comic) => (
          <ComicCard
            key={comic.id}
            title={comic.title}
            latestChapter={comic.latestChapter}
            imageUrl={comic.imageUrl}
          />
        ))}
      </div>

      {/* Pagination would go here */}
      <div className = "flex justify-center mt-6">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  )
}

function generateComics(){
  const comics = [];
  for (let i = 1; i <= 200; i++) {
    comics.push({
      id: i,
      title: `Truyện ${i}`,
      latestChapter: `Chap ${i}`,
      imageUrl: `https://via.placeholder.com/150x200?text=Comic+${i}`,
    });
  }
  return comics;
}

export default ComicGrid