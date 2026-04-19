import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useBookStore } from '../store/useBookStore';
import { useThemeStore } from '../store/useThemeStore';
import { FiPlus, FiEdit, FiList, FiGlobe, FiLock, FiStar, FiBookOpen, FiChevronLeft, FiLoader, FiEdit3, FiCheckCircle, FiSettings } from 'react-icons/fi';
import Header from './HomePage/Header';
import { bookService } from '@/services/bookService';


const ExpandedChapterList = ({ bookId }: { bookId: number }) =>{
    const navigate = useNavigate();
    const [chapters, setChapters] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { isDark } = useThemeStore();

    useEffect(() => {
        const fetchChapters = async () => {
            try {
                const data = await bookService.getAuthorBookDetail(bookId);
                const fetchedChapters = data.metadata?.chapters || data.chapters || [];
                
                const sortedChapters = fetchedChapters.sort((a: any, b: any) => a.index - b.index);
                setChapters(sortedChapters);
            } catch (error) {
                console.error("Failed to load chapters for dashboard", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchChapters();
    }, [bookId]);

    if (isLoading) return <div className="p-4 text-center text-yellow-500 flex justify-center"><FiLoader className="animate-spin text-2xl" /></div>;
    
    if (chapters.length === 0) return <div className="p-4 text-center text-gray-500 text-sm">Chưa có chương nào.</div>;

    return (
        <div className= {`${isDark ? 'bg-gray-950/50' : 'bg-gray-50 '}  h-full max-h-[18rem] overflow-y-auto`}>
            {chapters.map((chapter) => (
                <div key={chapter.id} className= {`flex flex-wrap items-center justify-between p-3 border-b ${isDark ? 'border-gray-800 hover:bg-gray-800/50' : 'border-gray-200  hover:bg-gray-100'}   transition-colors group`}>
                    
                    {/* Chapter Info */}
                    <div className="flex flex-col">
                        <span className="font-bold text-sm">Chương {chapter.index}: {chapter.title}</span>
                        <div className="flex items-center gap-2 mt-1">
                            {/* Status Badge */}
                            {chapter.isDraft ? (
                                <span className= {`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'} font-bold`}>
                                    <FiEdit3 /> BẢN NHÁP
                                </span>
                            ) : (
                                <span className= {`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${isDark ? 'text-green-400' : 'text-green-600'} bg-green-500/20 font-bold`}>
                                    <FiCheckCircle /> ĐÃ XUẤT BẢN
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Setting Button */}
                    <button 
                        onClick={() => navigate(`/author/comic/${bookId}/chapter/${chapter.id}/edit`)}
                        className= {`p-2 ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg text-gray-500 hover:text-yellow-500 hover:border-yellow-500 transition-all shadow-sm `}
                        title="Cài đặt / Sửa chương"
                    >
                        <FiSettings />
                    </button>
                </div>
            ))}
        </div>
    );
}

const AuthorDashboardPage = () => {
    const navigate = useNavigate();
    const [expandedBookId, setExpandedBookId] = useState<number | null>(null);
    const { isDark } = useThemeStore();
    const { authorBooks, isFetchingAuthorBooks, fetchAuthorBooksDashBoard } = useBookStore();

    useEffect(() => {
        fetchAuthorBooksDashBoard();
    }, [fetchAuthorBooksDashBoard]);

    const renderStatusBadge = (status: string) => {
        switch (status) {
            case 'PUBLISHED':
                return <span className= {`px-2 py-1 bg-green-500/20 ${isDark ? 'text-green-400' : 'text-green-600'} text-xs font-bold rounded `}>ĐÃ XUẤT BẢN</span>;
            case 'DRAFT':
                return <span className= {`px-2 py-1 bg-yellow-500/20 ${isDark ? 'text-yellow-400' : 'text-yellow-600'} text-xs font-bold rounded `}>BẢN NHÁP</span>;
            case 'HIDDEN':
                return <span className= {`px-2 py-1 bg-red-500/20 ${isDark ? 'text-red-400' : 'text-red-600'} text-xs font-bold rounded `}>ĐÃ ẨN</span>;
            default:
                return null;
        }
    }

    const renderVisibilityIcon = (visibility: string) => {
        switch (visibility) {
            case 'PUBLIC': return <span className="flex items-center gap-1"><FiGlobe /> Công khai</span>;
            case 'MEMBERS': return <span className="flex items-center gap-1"><FiLock /> Thành viên</span>;
            case 'TIERS': return <span className="flex items-center gap-1"><FiStar /> Trả phí</span>;
            default: return null;
        }
    }

    return (
        <div className= {`min-h-screen pb-20 ${isDark ? 'bg-gray-950 text-gray-200' : 'bg-gray-50 text-gray-800'}`}>
            <Header onStartTour={function (): void {
                throw new Error('Function not implemented.');
            } }/>
            <div className= 'container mx-auto px-4 max-w-6xl pt-10'>

                {/* Dashboard Header */}
                <div className= 'flex flex-col md:flex-row justify-between items-center mb-10 gap-4'>
                    <div>
                        <h1 className="text-4xl font-black flex items-center gap-3">
                            <FiBookOpen className="text-yellow-500" /> Quản Lý Truyện
                        </h1>

                        <p className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Tất cả tác phẩm của bạn, bao gồm cả bản nháp và truyện đã ẩn.
                        </p>

                    </div>

                    <button
                        onClick={() => navigate('/author/comic/create')}
                        className= 'px-6 py-3 bg-yellow-500 text-gray-900 font-bold rounded-xl hover:bg-yellow-400 transition flex items-center gap-2 shadow-lg hover:shadow-yellow-500/30 whitespace-nowrap'
                    >
                        <FiPlus className="text-xl" /> Tạo Truyện Mới
                    </button>
                </div>

                {/* Loading State */}
                {isFetchingAuthorBooks ? (
                    <div className="flex justify-center py-20">
                        <span className="animate-pulse text-xl font-bold text-yellow-500">Đang tải dữ liệu...</span>
                    </div>
                ) : authorBooks.length === 0 ? (
                    
                    /* Empty State */
                    <div className= {`text-center py-20 rounded-2xl border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
                        <FiBookOpen className="text-6xl mx-auto mb-4 text-gray-400 opacity-50" />
                        <h3 className="text-2xl font-bold mb-2">Bạn chưa có truyện nào!</h3>
                        <p className="text-gray-500 mb-6">Hãy bắt đầu hành trình sáng tác của bạn ngay hôm nay.</p>
                        <button onClick={() => navigate('/author/comic/create')} className="px-6 py-2 bg-yellow-500 text-black font-bold rounded-lg hover:bg-yellow-400">
                            Tạo Truyện Mới
                        </button>
                    </div>

                ) : (
                    
                    /* Book Grid */
                    <div className="flex flex-col gap-6">
                        {authorBooks.map((book) => (
                            <div key={book.id} className={`flex flex-col rounded-2xl border transition-all hover:border-yellow-500 p-5 gap-5 ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
                                
                                {/* TOP SECTION: Cover | Details | Chapters */}
                                <div className="flex flex-col lg:flex-row gap-6">
                                    
                                    {/* 1. Cover Image (Left) */}
                                    <div className={`w-full sm:w-40 md:w-48 h-60 md:h-72 flex-shrink-0 rounded-xl overflow-hidden cursor-pointer ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`} onClick={() => navigate(`/comic/${book.slug}`)}>
                                        <img 
                                            src={book.coverUrl || 'https://via.placeholder.com/150x200?text=No+Cover'} 
                                            alt={book.title} 
                                            className="w-full h-full object-cover hover:scale-105 transition duration-300"
                                        />
                                    </div>

                                    {/* 2. Book Details (Middle) */}
                                    <div className="flex flex-col flex-shrink-0 lg:w-64">
                                        <div className="flex justify-between items-start mb-2">
                                            <Link to={`/comic/${book.slug}`} className="text-xl font-bold hover:text-yellow-500 transition line-clamp-2">
                                                {book.title}
                                            </Link>
                                        </div>
                                        
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            {renderStatusBadge(book.status)}
                                            <span className={`px-2 py-1 text-xs font-bold rounded ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-200 text-gray-600'} `}>
                                                {renderVisibilityIcon(book.visibility)}
                                            </span>
                                        </div>

                                        <div className="text-sm text-gray-500 mb-4 flex-grow">
                                            <p>Tổng số chương: <strong className={isDark ? 'text-white' : 'text-black'}>{book.totalAllChapters || 0}</strong></p>
                                            <p>Đã xuất bản: <strong className={isDark ? 'text-white' : 'text-black'}>{book.totalPublishedChapters || 0}</strong></p>
                                        </div>
                                    </div>

                                    {/* 3. The Chapter Box (Right Area - Your Red Box!) */}
                                    <div className="flex-grow">
                                        {expandedBookId === book.id ? (
                                            <div className= {`h-full border ${isDark ? 'border-gray-700' : 'border-gray-200'} rounded-xl overflow-hidden animate-fadeIn `}>
                                                <ExpandedChapterList bookId={book.id} />
                                            </div>
                                        ) : (
                                            /* Placeholder dashed box so the layout doesn't shrink when closed */
                                            <div className= {`hidden lg:flex h-full border-2 border-dashed ${isDark ? 'border-gray-800' : 'border-gray-200'} rounded-xl items-center justify-center opacity-70 `}>
                                                <p className="text-sm font-medium text-gray-400">Nhấn vào "Chương" để xem danh sách</p>
                                            </div>
                                        )}
                                    </div>

                                </div>

                                {/* BOTTOM SECTION: Action Buttons (Full Width) */}
                                <div className= {`flex gap-3 pt-5 border-t ${isDark ? 'border-gray-800' : 'border-gray-100'} `}>
                                    <button 
                                        onClick={() => setExpandedBookId(expandedBookId === book.id ? null : book.id)}
                                        className={`flex-1 py-3 text-sm font-bold rounded-xl transition flex justify-center items-center gap-2 border
                                            ${expandedBookId === book.id 
                                                ? 'bg-yellow-500 text-black border-yellow-500 shadow-md' 
                                                : isDark 
                                                    ? 'border-gray-700 hover:bg-gray-800 bg-transparent' 
                                                    : 'border-gray-200 hover:bg-gray-100 bg-transparent'   
                                            }`}
                                    >
                                        <FiList /> {expandedBookId === book.id ? 'Chương' : 'Chương'}
                                    </button>

                                    <button 
                                        onClick={() => navigate(`/author/comic/${book.id}/edit`)}
                                        className={`flex-1 py-3 ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'} text-sm font-bold rounded-xl transition flex justify-center items-center gap-2`}
                                    >
                                        <FiEdit /> Sửa
                                    </button>
                                    
                                    <button 
                                        onClick={() => navigate(`/author/comic/${book.id}/chapter/create`)}
                                        className={`flex-1 py-3 ${isDark ? 'text-yellow-400 bg-yellow-500/10' : 'text-yellow-700 bg-yellow-50'} hover:bg-yellow-500 hover:text-black text-sm font-bold rounded-xl transition flex justify-center items-center gap-2`}
                                    >
                                        <FiPlus /> Thêm Chương
                                    </button>
                                </div>

                            </div>
                        ))}

                    </div>
                )}

            </div>
        </div>
    )
}

export default AuthorDashboardPage