import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useBookStore } from '../store/useBookStore';
import { useThemeStore } from '../store/useThemeStore';
import { FiFileText, FiEye, FiSettings, FiCheckCircle, FiImage, FiChevronLeft } from 'react-icons/fi';
import { type CreateChapterPayload } from '../type/book';

const CreateChapterPage = () => {
    const { bookId } = useParams();
    const navigate = useNavigate();
    const { isDark } = useThemeStore();

    const { currentBook, fetchAuthorBookDetail, isCreatingChapter, createNewChapter } = useBookStore();

    const [formData, setFormData] = useState({
        title: '',
        contentMarkdown: '',
        visibility: 'PUBLIC',
        isDraft: false
    });

    useEffect(() => {
        if (bookId) {
            fetchAuthorBookDetail(Number(bookId)); 
        }
    }, [bookId, fetchAuthorBookDetail]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target as any;

        if (type === 'checkbox') {
            setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!currentBook?.id) return;

        const payload: CreateChapterPayload = {
            title: formData.title.trim(),
            contentMd: formData.contentMarkdown.trim(),
            visibility: formData.visibility as 'PUBLIC' | 'MEMBERS' | 'TIERS',
            isDraft: formData.isDraft ? 1 : 0
        }

        const success = await createNewChapter(currentBook.id, payload)
        if (success) {
            navigate(`/author/dashboard`);
        }
    }

    const inputClasses = `w-full px-4 py-3 rounded-lg border outline-none transition-colors 
        ${isDark ? 'bg-gray-800 border-gray-700 text-white focus:border-yellow-500 placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 focus:border-yellow-500 placeholder-gray-400'}`;

    if (!currentBook) {
        return <div className="min-h-screen pt-24 text-center">Đang tải dữ liệu...</div>
    }

    return (
        <div className= {`min-h-screen pt-24 pb-20 ${isDark ? 'bg-gray-950 text-gray-200' : 'bg-gray-50 text-gray-800'}`}>
            <div className= 'container mx-auto px-4 max-w-4xl'>

                {/* Back Button */}
                <Link to = {`/author/dashboard`} className= 'inline-flex items-center gap-2 mb-6 text-gray-500 hover:text-yellow-500 transition font-medium'>
                    <FiChevronLeft className="text-xl" /> Quay lại
                </Link>

                <div className= 'text-center mb-10'>
                    <h1 className= 'text-4xl font-black mb-2 flex items-center justify-center gap-3'>
                        <FiFileText className="text-yellow-500" /> Đăng Chương Mới
                    </h1>

                    <p className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Thêm chương mới cho truyện <span className="font-bold text-yellow-500">"{currentBook.title}"</span>
                    </p>
                </div>

                <form onSubmit={handleSubmit} className={`p-8 rounded-2xl shadow-xl ${isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-100'}`}>

                    {/* CHAPTER TITLE */}
                    <div className= 'mb-6'>
                        <label className= 'block text-sm font-bold mb-2 uppercase tracking-wide opacity-80'>
                            Tên Chương (Bắt buộc)
                        </label>
                        <input 
                            type="text" 
                            name="title" 
                            required 
                            placeholder="VD: Chương 1: Khởi Đầu Mới"
                            value={formData.title} 
                            onChange={handleChange} 
                            className={inputClasses} 
                        />
                    </div>

                    {/* CONTENT MARKDOWN (THE COMIC PAGES) */}
                    <div className= 'mb-6'>
                        <label className= 'block text-sm font-bold mb-2 uppercase tracking-wide opacity-80 flex items-center gap-2'>
                            <FiImage /> Nội Dung (Markdown Links Ảnh)
                        </label>

                        <p className={`text-xs mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Dán các đường link ảnh của bạn theo định dạng Markdown. VD: <code>![Trang 1](https://link-anh.jpg)</code>
                        </p>

                        <textarea 
                            name="contentMarkdown" 
                            required
                            rows={15} 
                            placeholder="![Trang 1](https://...)&#10;![Trang 2](https://...)"
                            value={formData.contentMarkdown} 
                            onChange={handleChange} 
                            className={`${inputClasses} font-mono text-sm leading-relaxed resize-y`}
                        ></textarea>
                    </div>

                    {/* VISIBILITY & DRAFT SETTINGS */}
                    <div className= 'grid grid-cols-1 md:grid-cols-2 gap-6 mb-10 p-6 rounded-xl bg-black/5 dark:bg-black/20 border border-gray-200 dark:border-gray-800'>
                        <div>
                            <label className="block text-sm font-bold mb-2 uppercase tracking-wide opacity-80 flex items-center gap-2">
                                <FiEye /> Quyền Xem
                            </label>
                            <select name="visibility" value={formData.visibility} onChange={handleChange} className={inputClasses}>
                                <option value="PUBLIC">Công Khai (Tất cả mọi người)</option>
                                <option value="MEMBERS">Thành Viên (Cần đăng nhập)</option>
                                <option value="TIERS">Trả Phí (Tier)</option>
                            </select>
                        </div>

                        <div className= 'flex flex-col justify-center pt-2'>
                            <label className="block text-sm font-bold mb-2 uppercase tracking-wide opacity-80 flex items-center gap-2">
                                <FiSettings /> Trạng Thái Đăng
                            </label>

                            <label className="flex items-center gap-3 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    name="isDraft"
                                    checked={formData.isDraft}
                                    onChange={handleChange}
                                    className="w-5 h-5 accent-yellow-500 cursor-pointer"
                                />
                                <span className="font-medium">
                                    Lưu Nháp (Chưa xuất bản ngay)
                                </span>
                            </label>

                        </div>
                    </div>

                    {/* SUBMIT BUTTON */}
                    <button
                        type= 'submit'
                        disabled = {isCreatingChapter || !formData.title.trim() || !formData.contentMarkdown.trim()}
                        className = {`w-full py-4 rounded-xl font-black text-lg flex items-center justify-center gap-2 transition-all 
                                    ${isCreatingChapter || !formData.title.trim() || !formData.contentMarkdown.trim()
                                        ?isDark
                                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                                            : 'bg-gray-400 text-gray-200 cursor-not-allowed ' 
                                        : 'bg-yellow-500 text-gray-900 hover:bg-yellow-400 shadow-lg hover:shadow-yellow-500/30'}`}
                    >
                        {isCreatingChapter ? (
                            <span className="animate-pulse">Đang Tạo Chương...</span>
                        ) : (
                            <><FiCheckCircle className="text-xl" /> Đăng Chương</>
                        )}
                    </button>
                </form>
            </div>
        </div>
    )

}

export default CreateChapterPage;