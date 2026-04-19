import React, { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useBookStore } from '../store/useBookStore';
import { useThemeStore } from '../store/useThemeStore';
import { FiUser, FiBook, FiList } from 'react-icons/fi';

const AuthorProfilePage = () => {
    // Get the ID from the URL
    const { authorId } = useParams<{ authorId: string }>();
    const navigate = useNavigate();
    const { isDark } = useThemeStore();

    // Pull our data and functions from the store
    const { books, isLoadingBooks, fetchAuthorBooks } = useBookStore();

    // Fetch the books when the page loads
    useEffect(() => {
        if (authorId) {
            const id = parseInt(authorId, 10);
            fetchAuthorBooks(id, { limit: 20 });
        }
    }, [authorId, fetchAuthorBooks]);

    // --- LOADING STATE ---
    if (isLoadingBooks) {
        return (
            <div className={`min-h-screen pt-24 flex justify-center ${isDark ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
                <div className="animate-pulse flex flex-col items-center">
                    <div className="h-16 w-16 bg-gray-400 rounded-full mb-4"></div>
                    <div className="h-4 w-32 bg-gray-400 rounded mb-8"></div>
                    {/* Skeleton Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                        {[1, 2, 3, 4, 5].map(n => (
                            <div key={n} className="w-40 h-60 bg-gray-400 rounded-lg"></div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    // Extract the author's name from the first book if available!
    const authorNameDisplay = books.length > 0 && books[0].authorName 
        ? books[0].authorName 
        : `Tác giả #${authorId}`;

    return (
        <div className={`min-h-screen pb-20 pt-24 ${isDark ? 'bg-gray-950 text-gray-200' : 'bg-gray-50 text-gray-800'}`}>
            <div className="container mx-auto px-4 max-w-6xl">

                {/* AUTHOR HEADER */}
                <div className={`flex flex-col items-center md:flex-row md:items-start gap-6 p-8 rounded-2xl mb-10 shadow-sm
                    ${isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-200'}`}
                >

                    <div className="w-24 h-24 bg-yellow-500 rounded-full flex items-center justify-center text-4xl text-gray-900 shadow-lg flex-shrink-0">
                        <FiUser />
                    </div>
                    <div className="text-center md:text-left">
                        <h1 className="text-3xl font-black mb-2">{authorNameDisplay}</h1>
                        <p className={`flex items-center justify-center md:justify-start gap-2 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            <FiBook /> Tổng số truyện: {books.length}
                        </p>
                    </div>

                </div>

                {/* COMIC GRID */}
                <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <span className="w-1 h-6 bg-yellow-500 rounded-full block"></span>
                        Tác phẩm đã đăng
                    </h2>
                </div>

                {books.length === 0 ? (

                    <div className={`text-center py-20 rounded-2xl ${isDark ? 'bg-gray-900/50' : 'bg-white shadow-sm'}`}>
                        <p className="text-lg opacity-60">Tác giả này chưa có tác phẩm nào được xuất bản.</p>
                    </div>

                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">

                        {books.map((book) => (
                            <div
                                key={book.id} 
                                onClick={() => navigate(`/comic/${book.slug}`)}
                                className={`group cursor-pointer rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-xl
                                    ${isDark ? 'bg-gray-900 hover:shadow-yellow-500/10' : 'bg-white hover:shadow-gray-300/50'}`}
                            >

                                {/* Cover Image */}
                                <div className="relative aspect-[2/3] overflow-hidden bg-gray-200 dark:bg-gray-800">
                                    <img 
                                        src={book.coverUrl || 'https://static.dc.com/sites/default/files/imce/2022/09-SEP/ActionComics1_63180dcb385a45.72864065.jpg'} 
                                        alt={book.title}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    />
                                    {/* Locked Badge if premium */}
                                    {book.hasMembersChapters && (
                                        <div className="absolute top-2 right-2 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded shadow">
                                            Premium
                                        </div>
                                    )}
                                </div>

                                {/* Book Info */}
                                <div className="p-4">
                                    <h3 className="font-bold text-lg leading-tight mb-2 line-clamp-2 group-hover:text-yellow-500 transition-colors">
                                        {book.title}
                                    </h3>
                                    <div className={`text-xs font-medium flex items-center gap-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                        <FiList /> {book.totalChapters} Chương
                                    </div>
                                </div>

                            </div>
                        ))}

                    </div>
                )}
            </div>
        </div>
    )
}

export default AuthorProfilePage;