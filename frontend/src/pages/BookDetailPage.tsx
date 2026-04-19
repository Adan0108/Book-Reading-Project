import React, { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useBookStore } from '../store/useBookStore';
import { useThemeStore } from '../store/useThemeStore';
import { FiBookOpen, FiUser, FiList, FiClock } from 'react-icons/fi';
import Header from './HomePage/Header';

const BookDetailPage = () => {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const { isDark } = useThemeStore();

    // 1. Get state and actions from the store
    const { currentBook, currentBookChapters, isLoadingBookDetail, fetchBookBySlug, fetchBookChapters } = useBookStore();

    // 2. Fetch data when the URL slug changes
    useEffect(() => {
        if (slug) {
          fetchBookBySlug(slug);
          fetchBookChapters(slug);
        }
    }, [slug, fetchBookBySlug, fetchBookChapters]);

    // --- LOADING STATE ---
    if (isLoadingBookDetail) {
        return (
            <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
                <div className="animate-pulse flex flex-col items-center">
                    <div className="h-12 w-12 bg-gray-400 rounded-full mb-4"></div>
                    <p className="text-xl font-medium">Đang tải truyện...</p>
                </div>
            </div>
        );
    }

    // --- 404 / NOT FOUND STATE ---
    if (!currentBook) {
        return (
            <div className={`min-h-screen flex flex-col items-center justify-center gap-4 ${isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
                <h1 className="text-6xl font-bold text-gray-300">404</h1>
                <p className="text-xl">Không tìm thấy truyện này!</p>
                <button 
                    onClick={() => navigate('/')}
                    className="px-6 py-2 bg-yellow-500 text-black font-bold rounded-full hover:bg-yellow-400 transition"
                >
                    Về Trang Chủ
                </button>
            </div>
        );
    }

    // --- MAIN CONTENT ---
    return (
        <div className={`min-h-screen pb-20 ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-800'}`}>
            
            
            {/* HEADER / BANNER SECTION */}
            {/* 1. THE FROZEN BACKGROUND (Moved up, changed to Fixed) */}
            <div className="fixed inset-0 z-0 h-96 overflow-hidden pointer-events-none">
                {/* Blurred Image */}
                <div 
                    className="absolute inset-0 bg-cover bg-center transform scale-100 blur-sm"
                    style={{ backgroundImage: `url(${currentBook.coverUrl || 'https://img.buzzfeed.com/buzzfeed-static/static/2022-03/30/23/asset/c14c01274175/sub-buzz-532-1648681737-1.jpg?downsize=700%3A%2A&output-quality=auto&output-format=auto'})` }}
                ></div>
                {/* Color Overlay */}
                <div className={`absolute inset-0 ${isDark ? 'bg-black/70' : 'bg-white/60'}`}></div>
                {/* Gradient Fade to Page Color */}
                <div className={`absolute bottom-0 w-full h-32 bg-gradient-to-t to-transparent ${isDark ? 'from-gray-900' : 'from-gray-50'}`}></div>
            </div>
            
            <div className="relative z-10">

                <Header onStartTour={function (): void {
                    throw new Error('Function not implemented.');
                } }/>

                <div className="container mx-auto px-4 max-w-6xl mt-12 relative z-10">
                    <div className="flex flex-col md:flex-row gap-8">

                        {/* LEFT COLUMN: COVER IMAGE */}
                        <div className="flex-shrink-0 mx-auto md:mx-0">
                            <img 
                                src={currentBook.coverUrl || 'https://img.buzzfeed.com/buzzfeed-static/static/2022-03/30/23/asset/c14c01274175/sub-buzz-532-1648681737-1.jpg?downsize=700%3A%2A&output-quality=auto&output-format=auto'} 
                                alt={currentBook.title}
                                className="w-64 h-96 object-cover rounded-lg shadow-2xl border-4 border-white dark:border-gray-800"
                            />
                        </div>

                        {/* RIGHT COLUMN: INFO */}
                        <div className="flex-1 pt-4 md:pt-32 text-center md:text-left">
                            <h1 className="text-3xl md:text-5xl font-black mb-4 leading-tight">
                                {currentBook.title}
                            </h1>

                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mb-6 text-sm font-medium opacity-90">
                                
                                <Link 
                                    to={`/author/${currentBook.authorProfile?.id}`} 
                                    className="flex items-center gap-2 hover:text-yellow-500 transition-colors cursor-pointer"
                                >
                                    <FiUser className="text-yellow-500" />
                                    {currentBook.authorProfile?.penName || 'Tác giả chưa cập nhật'}
                                </Link>

                                <span className="flex items-center gap-2">
                                    <FiList className="text-yellow-500" />
                                    {currentBook.totalChapters} Chương
                                </span>
                                
                                {/* Status Badge */}
                                <span className={`px-3 py-0.5 rounded-full text-xs border ${
                                    currentBook.publishStatus === 'PUBLISHED' 
                                    ? 'border-green-500 text-green-500 bg-green-500/10' 
                                    : 'border-gray-500 text-gray-500'
                                }`}>
                                    {currentBook.publishStatus || 'Đang tiến hành'}
                                </span>
                            </div>

                            {/* TAGS */}
                            {currentBook.tags && currentBook.tags.length > 0 && (
                                <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-6">
                                    {currentBook.tags.map((tag: any, index) => (
                                        <span 
                                            key={index} 
                                            className={`px-3 py-1 rounded-md text-xs font-semibold tracking-wide uppercase
                                                ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-200 text-gray-600'}`}
                                        >
                                            {typeof tag === 'string' ? tag : tag.name}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* ACTION BUTTONS */}
                            <div className="flex gap-4 justify-center md:justify-start mb-8">
                            <button 
                                onClick={() => navigate(`/comic/${currentBook.slug}/chapters/1`)}
                                disabled={!currentBookChapters || currentBookChapters.length === 0}
                                className={`px-6 py-2 rounded-full font-bold flex items-center gap-2 transition-all 
                                    ${(!currentBookChapters || currentBookChapters.length === 0) 
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600' 
                                        : 'bg-yellow-500 text-black hover:bg-yellow-400 shadow-md hover:shadow-yellow-500/30'
                                    }`}
                            >
                                📖 Đọc Ngay
                            </button>
                                <button className={`px-8 py-3 font-bold rounded-full border transition-all active:scale-95
                                    ${isDark 
                                        ? 'border-gray-600 hover:bg-gray-800 text-white' 
                                        : 'border-gray-300 hover:bg-gray-100 text-gray-900'}`}
                                >
                                    Theo Dõi
                                </button>
                            </div>
                        </div>

                    </div>

                    {/* SYNOPSIS & CHAPTERS */}
                    <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8">

                        {/* Left: Synopsis */}
                        <div className="lg:col-span-2">
                            <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
                                <span className="w-1 h-8 bg-yellow-500 rounded-full block"></span>
                                Giới Thiệu
                            </h3>
                            <div className={`p-6 rounded-2xl leading-relaxed ${isDark ? 'bg-gray-800/50' : 'bg-white shadow-sm'}`}>
                                <p className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                                    {currentBook.synopsis || "Chưa có nội dung mô tả cho truyện này."}
                                </p>
                            </div>
                        </div>

                        {/* Right: Chapter List Placeholder */}
                        <div>
                            <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
                                <span className="w-1 h-8 bg-green-500 rounded-full block"></span>
                                Mới Cập Nhật
                            </h3>
                            <div className={`rounded-2xl overflow-hidden ${isDark ? 'bg-gray-800/50' : 'bg-white shadow-sm'}`}>

                                {/* We will implement the real Chapter List next! */}
                                {currentBookChapters.length === 0 ? (
                                    <div className="p-4 text-center opacity-60 italic">
                                        Chưa có chương nào được cập nhật.
                                    </div>
                                ) : (
                                    <ul className="max-h-96 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700">
                                        {currentBookChapters.map((chapter) => (
                                            <li 
                                                key={chapter.id} 
                                                onClick={() => navigate(`/comic/${slug}/chapters/${chapter.index}`)}
                                                className={`p-4 transition cursor-pointer flex justify-between items-center group
                                                    ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}
                                            >
                                                <div className="flex flex-col">
                                                    <span className={`font-semibold group-hover:text-yellow-500 transition-colors ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                                        Chương {chapter.index}
                                                        {chapter.title ? `: ${chapter.title}` : ''}
                                                    </span>
                                                    {/* Optional: Show published date if your backend provides it */}
                                                    <span className="text-xs text-gray-500 mt-1">
                                                        {chapter.publishedAt ? new Date(chapter.publishedAt).toLocaleDateString() : 'Mới cập nhật'}
                                                    </span>
                                                </div>

                                                {/* Lock Icon for Premium Chapters */}
                                                <div className="text-gray-400">
                                                    {chapter.visibility !== 'PUBLIC' && (
                                                        <span title="Chương yêu cầu mở khóa" className="text-yellow-600">🔒</span>
                                                    )}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                
                            </div>
                        </div>

                    </div>

                </div>
            </div>

        </div>
    );
}

export default BookDetailPage;