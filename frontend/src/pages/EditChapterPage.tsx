import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useBookStore } from '../store/useBookStore';
import { useThemeStore } from '../store/useThemeStore';
import { FiFileText, FiEye, FiSettings, FiCheckCircle, FiImage, FiChevronLeft } from 'react-icons/fi';
import { type UpdateChapterPayload } from '../type/book';
import { useAuthStore } from '@/store/useAuthStore';

const EditChapterPage = () => {
    const { bookId, chapterId } = useParams()
    const navigate = useNavigate();
    const { isDark } = useThemeStore();

    const { currentBook, currentChapter, fetchAuthorBookDetail, fetchAuthorChapterDetail, isUpdatingChapter, updateChapterDetails } = useBookStore();
    const { authUser, isFetchingUser } = useAuthStore();

    const [formData, setFormData] = useState({
        title: '',
        contentMarkdown: '',
        visibility: 'PUBLIC',
        isDraft: false
    });

    useEffect(() => {
        console.log("Checking before fetch:", { 
            hasUser: !!authUser, 
            isFetchingUser, 
            bookId, 
            chapterId 
        });

        // 2. Relaxed Condition: Only wait for isFetchingUser to finish. 
        // We let the Axios interceptor handle the actual token auth!
        if (!isFetchingUser) {
            if (bookId) {
                fetchAuthorBookDetail(Number(bookId)); 
            }
            if (bookId && chapterId) {
                fetchAuthorChapterDetail(Number(bookId), Number(chapterId));
            }
        }
    }, [bookId, chapterId, authUser, isFetchingUser, fetchAuthorBookDetail, fetchAuthorChapterDetail])

    useEffect(() => {
        if (currentChapter) {
            setFormData({
                title: currentChapter.title || '',
                // Note: Ensure your Chapter type has contentMd or contentMarkdown depending on what the GET request returns!
                contentMarkdown: currentChapter.contentMarkdown || (currentChapter as any).contentMd || '',
                visibility: currentChapter.visibility || 'PUBLIC',
                isDraft: Boolean(currentChapter.isDraft)
            })
        }
    }, [currentChapter])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target as any;
        if (type === 'checkbox') {
            setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
        } 
        else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentBook?.id || !currentChapter?.id) return;

        const payload: UpdateChapterPayload = {
            title: formData.title.trim(),
            contentMd: formData.contentMarkdown.trim(), 
            visibility: formData.visibility as 'PUBLIC' | 'MEMBERS' | 'TIERS',
            isDraft: formData.isDraft ? 1 : 0
        }

        const success = await updateChapterDetails(currentBook.id, currentChapter.id, payload);
        if (success) {
            navigate(`/author/dashboard`); 
        }
    }

    const inputClasses = `w-full px-4 py-3 rounded-lg border outline-none transition-colors 
        ${isDark ? 'bg-gray-800 border-gray-700 text-white focus:border-yellow-500 placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 focus:border-yellow-500 placeholder-gray-400'}`;

    if (!currentBook || !currentChapter) {
        return <div className='min-h-screen pt-24 text-center'>Đang tải dữ liệu chương...</div>;
    }

    return (
        <div className = {`min-h-screen pt-24 pb-20 ${isDark ? 'bg-gray-950 text-gray-200' : 'bg-gray-50 text-gray-800'}`}>
            <div className = 'container mx-auto px-4 max-w-4xl'>
                
                <Link to={`/author/dashboard`} className="inline-flex items-center gap-2 mb-6 text-gray-500 hover:text-yellow-500 transition font-medium">
                    <FiChevronLeft className="text-xl" /> Quay lại
                </Link>

                <div className = 'text-center mb-10'>
                    <h1 className = 'text-4xl font-black mb-2 flex items-center justify-center gap-3'>
                        <FiSettings className="text-yellow-500" /> Sửa Chương
                    </h1>
                </div>

                <form onSubmit={handleSubmit} className = {`p-8 rounded-2xl shadow-xl ${isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-100'}`}>

                    <div className = 'mb-6'>
                        <label className='block text-sm font-bold mb-2 uppercase tracking-wide opacity-80'>Tên Chương</label>
                        <input 
                            type="text" 
                            name="title" 
                            required value={formData.title} 
                            onChange={handleChange} 
                            className={inputClasses} 
                        />
                    </div>

                    <div className='mb-6'>
                        <label className='block text-sm font-bold mb-2 uppercase tracking-wide opacity-80 flex items-center gap-2'>
                            <FiImage /> Nội Dung (Markdown)
                        </label>
                        <textarea 
                            name="contentMarkdown" 
                            required rows={15} 
                            value={formData.contentMarkdown} 
                            onChange={handleChange} 
                            className={`${inputClasses} font-mono text-sm leading-relaxed resize-y`}
                        ></textarea>
                    </div>

                    <div className= {`grid grid-cols-1 md:grid-cols-2 gap-6 mb-10 p-6 rounded-xl border ${isDark ? 'bg-black/20 border-gray-800' : 'bg-black/5 border-gray-200'}`}>

                        <div>
                            <label className='block text-sm font-bold mb-2 uppercase tracking-wide opacity-80 flex items-center gap-2'>
                                <FiEye /> Quyền Xem
                            </label>
                            <select name="visibility" value={formData.visibility} onChange={handleChange} className={inputClasses}>
                                <option value="PUBLIC">Công Khai</option>
                                <option value="MEMBERS">Thành Viên</option>
                                <option value="TIERS">Trả Phí</option>
                            </select>
                        </div>

                        <div className='flex flex-col justify-center pt-2'>
                            <label className='block text-sm font-bold mb-2 uppercase tracking-wide opacity-80 flex items-center gap-2'>
                                <FiSettings /> Trạng Thái
                            </label>
                            <label className='flex items-center gap-3 cursor-pointer'>
                                <input 
                                    type="checkbox" 
                                    name="isDraft" 
                                    checked={formData.isDraft} 
                                    onChange={handleChange} 
                                    className="w-5 h-5 accent-yellow-500 cursor-pointer" 
                                />
                                <span className="font-medium">Lưu Nháp</span>
                            </label>
                        </div>

                    </div>

                    <button 
                        type="submit" 
                        disabled={isUpdatingChapter || !formData.title.trim()} 
                        className={`w-full py-4 rounded-xl font-black text-lg flex items-center justify-center gap-2 transition-all ${isUpdatingChapter ? 'bg-gray-400 text-gray-200 cursor-not-allowed' : 'bg-yellow-500 text-gray-900 hover:bg-yellow-400 shadow-lg hover:shadow-yellow-500/30'}`}
                    >
                        {isUpdatingChapter ? <span className="animate-pulse">Đang Lưu...</span> : <><FiCheckCircle className="text-xl" /> Lưu Thay Đổi</>}
                    </button>

                </form>

            </div>
        </div>
    )
}

export default EditChapterPage;