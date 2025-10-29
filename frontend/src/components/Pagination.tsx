import React from 'react'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (pageNumber: number) => void;
}

const DOTS = '...';


/**
 * A helper function to generate the array of page numbers and dots
 * e.g., [1, 2, '...', 6, 7, 8, '...', 663, 664]
 */
const generatePagination = (currentPage: number, totalPages: number): (number | '...')[] => {

    if (totalPages <= 7) {
        return Array.from({ length:totalPages }, (_, i) => i + 1);
    }

    if (currentPage < 5) {
        return [1, 2, 3, 4, 5, DOTS, totalPages];
    }

    if (currentPage > totalPages - 4){
        return [1, DOTS, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, DOTS, currentPage - 1, currentPage, currentPage + 1, DOTS, totalPages];
}

const Pagination: React.FC<PaginationProps> = ({currentPage, totalPages, onPageChange}) => {

    const paginationItems = generatePagination(currentPage, totalPages);

    const handlePrevious = () => {
        if (currentPage >1){
            onPageChange(currentPage - 1);
        }
    }

    const handleNext = () => {
        if (currentPage < totalPages){
            onPageChange(currentPage + 1);
        }
    }

    return (
    
        <nav className = "flex justify-center items-center space-x-1">
            
            {/* Previous Button */}
            <button
                onClick={handlePrevious}
                disabled={currentPage === 1}
                className="flex items-center justify-center h-10 w-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
            >
                <FiChevronLeft className="w-5 h-5" />
            </button>

            {/* Page Numbers */}
            {paginationItems.map((item, index) => {
                if (item === DOTS){
                    return (
                        <span key={index} className='flex items-center justify-center h-10 w-10 text-gray-500 dark:text-gray-400'>...</span>
                    )
                }

                return (
                    <button
                        key={index}
                        onClick={() => onPageChange(item)}
                        className={`flex items-center justify-center h-10 w-10 rounded-md font-medium ${
                        currentPage === item
                            ? 'bg-yellow-500 text-gray-900 border border-yellow-500' // Active style (matches your "2" button)
                            : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700' // Inactive style
                        }`}
                    >
                        {item}
                    </button>
                )
            })}

            {/* Next Button */}
            <button
                onClick={handleNext}
                disabled={currentPage === totalPages}
                className="flex items-center justify-center h-10 w-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
            >
                <FiChevronRight className="w-5 h-5" />
            </button>
        </nav>
  )
}

export default Pagination