import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useBookStore } from '../store/useBookStore';
import { useThemeStore } from '../store/useThemeStore';
import { FiBook, FiImage, FiTag, FiEye, FiSettings, FiCheckCircle, FiGrid, FiChevronLeft } from 'react-icons/fi';
import type { UpdateBookPayload } from '../type/book';

const EditBookPage = () => {
    const { bookId } = useParams();
    const navigate = useNavigate();
    const { isDark } = useThemeStore();

    const { currentBook, fetchAuthorBookDetail, isUpdatingBook, updateBookDetails } = useBookStore();

    const [formData, setFormData] = useState({
        title: '',
        slug: '',
        genre: '',
        synopsis: '',
        tags: [] as string[],
        coverUrl: '',
        visibility: 'PUBLIC',
        status: 'DRAFT'
    })

    const [availableTags, setAvailableTags] = useState<{id: number, slug: string, name: string}[]>([]);

    useEffect(() => {
        if (bookId) {
            fetchAuthorBookDetail(Number(bookId)); 
        }

        setAvailableTags([
            { id: 1, slug: 'magic', name: 'magic' },
            { id: 2, slug: 'adventure', name: 'adventure' }
        ]);
    }, [bookId, fetchAuthorBookDetail])

    useEffect(() => {
        if (currentBook) {
            setFormData({
                title: currentBook.title || '',
                slug: currentBook.slug || '',
                genre: currentBook.genre || '',
                synopsis: currentBook.synopsis || '',
                tags: currentBook.tags ? currentBook.tags.map((t: any) => typeof t === 'string' ? t : t.name) : [],
                coverUrl: currentBook.coverUrl || (currentBook as any).cover_image_url || '',
                visibility: currentBook.visibility || 'PUBLIC',
                status: currentBook.status || 'DRAFT'
            })
        }
    }, [currentBook])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }

    const handleTagSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedTag = e.target.value;
        if (selectedTag && !formData.tags.includes(selectedTag)) {
            setFormData(prev => ({ ...prev, tags: [...prev.tags, selectedTag] }));
        }
        e.target.value = ""; 
    }

    const removeTag = (tagToRemove: string) => {
        setFormData(prev => ({
            ...prev,
            tags: prev.tags.filter(t => t !== tagToRemove)
        }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!currentBook?.id) return;

        const payload: UpdateBookPayload = {
            title: formData.title.trim(),
            genre: formData.genre.trim(),
            synopsis: formData.synopsis.trim(),
            coverUrl: formData.coverUrl.trim(),
            visibility: formData.visibility as 'PUBLIC' | 'MEMBERS' | 'TIERS',
            status: formData.status as 'DRAFT' | 'PUBLISHED' | 'HIDDEN',
            tags: formData.tags
        };

        const success = await updateBookDetails(currentBook.id, payload);
        
        if (success) {
            navigate(`/author/dashboard`); 
        }
    }

    const inputClasses = `w-full px-4 py-3 rounded-lg border outline-none transition-colors 
        ${isDark ? 'bg-gray-800 border-gray-700 text-white focus:border-yellow-500 placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 focus:border-yellow-500 placeholder-gray-400'}`;

    if (!currentBook) {
        return <div className="min-h-screen pt-24 text-center">Đang tải dữ liệu truyện...</div>;
    }

    return (
        <div className= {`min-h-screen pt-24 pb-20 ${isDark ? 'bg-gray-950 text-gray-200' : 'bg-gray-50 text-gray-800'}`}>
            <div className= 'container mx-auto px-4 max-w-3xl'>

                {/* Back Button */}
                <Link to = {`/author/dashboard`} className= 'inline-flex items-center gap-2 mb-6 text-gray-500 hover:text-yellow-500 transition font-medium'>
                    <FiChevronLeft className="text-xl" /> Quay lại
                </Link>

                <div className= 'text-center mb-10'>
                    <h1 className="text-4xl font-black mb-2 flex items-center justify-center gap-3">
                        <FiSettings className="text-yellow-500" /> Cập Nhật Truyện
                    </h1>
                    <p className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Chỉnh sửa thông tin tác phẩm "{currentBook.title}"
                    </p>
                </div>

                <form onSubmit= {handleSubmit} className= {`p-8 rounded-2xl shadow-xl ${isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-100'}`}>

                    {/* TITLE */}
                    <div className= 'mb-6'>
                        <label className= 'block text-sm font-bold mb-2 uppercase tracking-wide opacity-80'>Tên Truyện</label>
                        <input 
                            type="text" 
                            name="title" 
                            required value={formData.title} 
                            onChange={handleChange} 
                            className={inputClasses} 
                        />
                    </div>

                    {/* SLUG & GENRE */}
                    <div className= 'grid grid-cols-1 md:grid-cols-2 gap-6 mb-6'>
                        <div>
                            <label className= 'block text-sm font-bold mb-2 uppercase tracking-wide opacity-80'>Đường Dẫn (Slug)</label>
                            <input 
                                type="text" 
                                name="slug" 
                                value={formData.slug} 
                                disabled // Physically locks the input
                                className={`${inputClasses} opacity-60 cursor-not-allowed bg-gray-200 dark:bg-gray-800`} 
                                title="Đường dẫn không thể thay đổi sau khi tạo" 
                            />
                            <p className="text-xs text-gray-500 mt-2 font-medium">
                                🔒 Đường dẫn là cố định để bảo vệ link truyện của bạn.
                            </p>
                        </div>
                        
                        <div>
                            <label className= 'block text-sm font-bold mb-2 uppercase tracking-wide opacity-80 flex items-center gap-2'><FiGrid /> Thể Loại Chính</label>
                            <input 
                                type="text" 
                                name="genre" 
                                value={formData.genre} 
                                onChange={handleChange} 
                                className={inputClasses} 
                            />
                        </div>
                    </div>

                    {/* COVER URL & TAGS */}
                    <div className= 'grid grid-cols-1 md:grid-cols-2 gap-6 mb-6'>
                        <div>
                            <label className='block text-sm font-bold mb-2 uppercase tracking-wide opacity-80 flex items-center gap-2'><FiImage /> Link Ảnh Bìa</label>
                            <input 
                                type="url" 
                                name="coverUrl" 
                                value={formData.coverUrl} 
                                onChange={handleChange} 
                                className={inputClasses} 
                            />
                        </div>

                        <div>
                            <label className= 'block text-sm font-bold mb-2 uppercase tracking-wide opacity-80 flex items-center gap-2'><FiTag /> Tags</label>
                            <select 
                                onChange={handleTagSelect} 
                                defaultValue="" 
                                className={inputClasses}
                            >
                                    <option value="" disabled>-- Chọn Tag --</option>
                                    {availableTags.map(tag => (
                                        <option key={tag.id} value={tag.name}>{tag.name}</option>
                                    ))}
                            </select>
                            {formData.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {formData.tags.map(tag => (
                                        <span key={tag} className="bg-yellow-500 text-black px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2 shadow-sm">
                                            {tag}
                                            <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-600 transition-colors bg-black/10 rounded-full w-5 h-5 flex items-center justify-center">×</button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* SYNOPSIS */}
                    <div className= 'mb-6'>
                        <label className= 'block text-sm font-bold mb-2 uppercase tracking-wide opacity-80'>Giới Thiệu Nội Dung</label>
                        <textarea 
                            name="synopsis" 
                            rows={4} 
                            value={formData.synopsis} 
                            onChange={handleChange} 
                            className={`${inputClasses} resize-y`}
                        ></textarea>
                    </div>

                    {/* VISIBILITY & STATUS */}
                    <div className= 'grid grid-cols-1 md:grid-cols-2 gap-6 mb-10'>
                        <div>
                            <label className="block text-sm font-bold mb-2 uppercase tracking-wide opacity-80 flex items-center gap-2"><FiEye /> Quyền Xem</label>
                            <select name="visibility" value={formData.visibility} onChange={handleChange} className={inputClasses}>
                                <option value="PUBLIC">Công Khai</option>
                                <option value="MEMBERS">Thành Viên</option>
                                <option value="TIERS">Trả Phí</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-bold mb-2 uppercase tracking-wide opacity-80 flex items-center gap-2"><FiSettings /> Trạng Thái</label>
                            <select name="status" value={formData.status} onChange={handleChange} className={inputClasses}>
                                <option value="DRAFT">Bản Nháp</option>
                                <option value="PUBLISHED">Xuất Bản</option>
                                <option value="HIDDEN">Ẩn</option>
                            </select>
                        </div>
                    </div>

                    <button type="submit" disabled={isUpdatingBook || !formData.title.trim()} className={`w-full py-4 rounded-xl font-black text-lg flex items-center justify-center gap-2 transition-all ${isUpdatingBook || !formData.title.trim() ? 'bg-gray-400 text-gray-200 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500' : 'bg-yellow-500 text-gray-900 hover:bg-yellow-400 shadow-lg hover:shadow-yellow-500/30'}`}>
                        {isUpdatingBook ? <span className="animate-pulse">Đang Lưu Lại...</span> : <><FiCheckCircle className="text-xl" /> Lưu Thay Đổi</>}
                    </button>
                </form>
            </div>
        </div>
    )
}

export default EditBookPage;