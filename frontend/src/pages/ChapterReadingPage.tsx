import React, { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useBookStore } from '../store/useBookStore';
import { useThemeStore } from '../store/useThemeStore';
import { FiChevronLeft, FiList, FiChevronRight } from 'react-icons/fi';

const ChapterReadingPage = () => {
    const { slug, chapterNo } = useParams<{ slug: string; chapterNo: string }>();
    const navigate = useNavigate();
    const { isDark } = useThemeStore();

    const { currentChapter, currentBook, isLoadingChapter, fetchChapterContent, fetchBookBySlug } = useBookStore();

    useEffect(() => {
        if (slug && chapterNo) {
            // Parse the chapterNo string from the URL into a number
            fetchChapterContent(slug, parseInt(chapterNo, 10));
            
            // If the user navigated directly to this URL, we might need to fetch the book title too!
            if (!currentBook || currentBook.slug !== slug) {
                fetchBookBySlug(slug);
            }
          }
    }, [slug, chapterNo, fetchChapterContent, fetchBookBySlug, currentBook]);

    // --- LOADING STATE ---
    if (isLoadingChapter){
        return (
            <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
                <div className="animate-pulse flex flex-col items-center">
                    <div className="h-10 w-10 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="font-medium">Đang tải nội dung chương...</p>
                </div>
            </div>
        );
    }

    // --- LOCKED / 404 STATE ---
    if (!currentChapter) {
        return (
            <div className={`min-h-screen flex flex-col items-center justify-center gap-4 ${isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
                <span className="text-6xl">🔒</span>
                <h2 className="text-2xl font-bold">Không thể tải chương này</h2>
                <p className="text-gray-500">Chương này có thể yêu cầu thành viên VIP hoặc không tồn tại.</p>
                <button 
                    onClick={() => navigate(`/comic/${slug}`)}
                    className="mt-4 px-6 py-2 bg-yellow-500 text-black font-bold rounded-full hover:bg-yellow-400 transition"
                >
                    Quay lại thông tin truyện
                </button>
            </div>
        );
    }

    return (
        <div className={`min-h-screen ${isDark ? 'bg-gray-950 text-gray-200' : 'bg-gray-100 text-gray-800'}`}>
            
            {/* READING NAVIGATION BAR */}
            <div className={`sticky top-0 z-40 shadow-sm transition-colors ${isDark ? 'bg-gray-900/95 border-b border-gray-800' : 'bg-white/95 border-b border-gray-200'}`}>
                
                <div className="container mx-auto px-4 py-3 flex items-center justify-between max-w-4xl">

                    {/* Back to Book Info */}
                    <Link to={`/comic/${slug}`} className="flex items-center gap-2 hover:text-yellow-500 transition-colors font-semibold truncate max-w-[200px] md:max-w-xs">
                        <FiChevronLeft className="text-xl flex-shrink-0" />
                        <span className="truncate">{currentBook?.title || 'Quay lại'}</span>
                    </Link>

                    {/* Current Chapter Indicator */}
                    <div className="font-bold text-center">
                        Chương {currentChapter.index}
                    </div>

                    {/* Placeholder for Next/Prev Controls */}
                    <div className="flex gap-2">
                        <button className={`p-2 rounded-full ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'}`} title="Danh sách chương">
                            <FiList className="text-xl" />
                        </button>
                    </div>

                </div>

            </div>

            {/* COMIC CONTENT CONTAINER */}
            <div className="container mx-auto max-w-3xl py-8 px-4 flex flex-col items-center shadow-2xl min-h-screen">
                
                {/* Title Header */}
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-black mb-2">Chương {currentChapter.index}</h1>
                    {currentChapter.title && (
                        <h2 className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{currentChapter.title}</h2>
                    )}
                </div>

                {/* Markdown Content Block */}
                <div className="w-full">
                    {/* Note: Since your API returns Markdown, we render it directly for now. 
                        If it contains image URLs (like ![page1](https://...)), you might need a Markdown parser 
                        like 'react-markdown' to render the images properly! */}
                    <pre className="whitespace-pre-wrap font-sans text-lg leading-relaxed break-words">
                        {currentChapter.contentMarkdown || 'Nội dung chương đang được cập nhật...'}
                    </pre>
                </div>

                {/* BOTTOM NAVIGATION */}
                <div className="w-full flex justify-between items-center mt-16 pt-8 border-t border-gray-500/30">
                    
                    {/* Previous Button */}
                    <button 
                        onClick={() => navigate(`/comic/${slug}/chapters/${currentChapter.index - 1}`)}
                        disabled={currentChapter.index <= 1}
                        className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition
                            ${currentChapter.index <= 1 
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600' 
                                : 'bg-gray-800 text-white hover:bg-yellow-500 hover:text-black'
                            }`}
                    >
                        <FiChevronLeft /> Chương trước
                    </button>

                    {/* Next Button */}
                    <button 
                        onClick={() => navigate(`/comic/${slug}/chapters/${currentChapter.index + 1}`)}
                        disabled={currentBook ? currentChapter.index >= currentBook.totalChapters : false}
                        className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition
                            ${(currentBook && currentChapter.index >= currentBook.totalChapters)
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600'
                                : 'bg-gray-800 text-white hover:bg-yellow-500 hover:text-black'
                            }`}
                    >
                        Chương sau <FiChevronRight />
                    </button>

                </div>

            </div>

        </div>
    );
};

export default ChapterReadingPage;