import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useBookStore } from '../store/useBookStore';
import { useThemeStore } from '../store/useThemeStore';
import { FiBook, FiImage, FiTag, FiEye, FiSettings, FiCheckCircle, FiGrid, FiChevronLeft } from 'react-icons/fi';
import type { CreateBookPayload } from '../type/book';

const CreateBookPage = () => {
    const navigate = useNavigate();
    const { isDark } = useThemeStore();
    const { isCreatingBook, createNewBook } = useBookStore();

    const [formData, setFormData] = useState({
        title: '',
        slug: '',
        genre: '', 
        synopsis: '',
        tags: [] as string[], 
        coverUrl: '',
        visibility: 'PUBLIC',
        status: 'DRAFT'
    });

    const [availableTags, setAvailableTags] = useState<{id: number, slug: string, name: string}[]>([]);

    useEffect(() => {
        setAvailableTags([
            { id: 1, slug: 'magic', name: 'magic' },
            { id: 2, slug: 'adventure', name: 'adventure' }
        ]);
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleTagSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedTag = e.target.value;
        if (selectedTag && !formData.tags.includes(selectedTag)) {
            setFormData(prev => ({ ...prev, tags: [...prev.tags, selectedTag] }));
        }
        e.target.value = ""; 
    };

    const removeTag = (tagToRemove: string) => {
        setFormData(prev => ({
            ...prev,
            tags: prev.tags.filter(t => t !== tagToRemove)
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const payload: CreateBookPayload = {
            title: formData.title.trim(),
            visibility: formData.visibility as 'PUBLIC' | 'MEMBERS' | 'TIERS',
            status: formData.status as 'DRAFT' | 'PUBLISHED' | 'HIDDEN', 
        };

        if (formData.slug.trim()) payload.slug = formData.slug.trim();
        if (formData.genre.trim()) payload.genre = formData.genre.trim(); 
        if (formData.synopsis.trim()) payload.synopsis = formData.synopsis.trim();
        if (formData.coverUrl.trim()) payload.coverUrl = formData.coverUrl.trim();
        
        if (formData.tags.length > 0) {
            payload.tags = formData.tags;
        }

        const success = await createNewBook(payload);
        
        if (success) {
            navigate('/author/dashboard'); 
        }
    };

    const inputClasses = `w-full px-4 py-3 rounded-lg border outline-none transition-colors 
        ${isDark 
            ? 'bg-gray-800 border-gray-700 text-white focus:border-yellow-500 placeholder-gray-500' 
            : 'bg-white border-gray-300 text-gray-900 focus:border-yellow-500 placeholder-gray-400'}`;

    return (
        <div className={`min-h-screen pt-24 pb-20 ${isDark ? 'bg-gray-950 text-gray-200' : 'bg-gray-50 text-gray-800'}`}>
            <div className="container mx-auto px-4 max-w-3xl">

                {/* Back Button */}
                <Link to = {`/author/dashboard`} className= 'inline-flex items-center gap-2 mb-6 text-gray-500 hover:text-yellow-500 transition font-medium'>
                        <FiChevronLeft className="text-xl" /> Quay lại
                </Link>
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-black mb-2 flex items-center justify-center gap-3">
                        <FiBook className="text-yellow-500" /> Thêm Truyện Mới
                    </h1>
                    <p className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Tạo và xuất bản tác phẩm của bạn trên MeoMic
                    </p>
                </div>

                <form onSubmit={handleSubmit} className={`p-8 rounded-2xl shadow-xl ${isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-100'}`}>
                    
                    {/* TITLE */}
                    <div className="mb-6">
                        <label className="block text-sm font-bold mb-2 uppercase tracking-wide opacity-80">
                            Tên Truyện (Bắt buộc)
                        </label>
                        <input 
                            type="text" 
                            name="title"
                            required
                            placeholder="VD: Chú Mèo Dũng Cảm..."
                            value={formData.title}
                            onChange={handleChange}
                            className={inputClasses}
                        />
                    </div>

                    {/* SLUG & GENRE (2 Columns) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label className="block text-sm font-bold mb-2 uppercase tracking-wide opacity-80">
                                Đường Dẫn (Slug)
                            </label>
                            <input 
                                type="text" 
                                name="slug"
                                placeholder="Để trống để tự động tạo"
                                value={formData.slug}
                                onChange={handleChange}
                                className={inputClasses}
                            />
                        </div>
                        <div>
                            {/* 3. New Genre Input */}
                            <label className="block text-sm font-bold mb-2 uppercase tracking-wide opacity-80 flex items-center gap-2">
                                <FiGrid /> Thể Loại Chính (Genre)
                            </label>
                            <input 
                                type="text" 
                                name="genre"
                                placeholder="VD: Fantasy, Action..."
                                value={formData.genre}
                                onChange={handleChange}
                                className={inputClasses}
                            />
                        </div>
                    </div>

                    {/* COVER URL & TAGS (2 Columns) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label className="block text-sm font-bold mb-2 uppercase tracking-wide opacity-80 flex items-center gap-2">
                                <FiImage /> Link Ảnh Bìa
                            </label>
                            <input 
                                type="url" 
                                name="coverUrl"
                                placeholder="https://..."
                                value={formData.coverUrl}
                                onChange={handleChange}
                                className={inputClasses}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-2 uppercase tracking-wide opacity-80 flex items-center gap-2">
                                <FiTag /> Tags (Từ cơ sở dữ liệu)
                            </label>
                            
                            {/* The Dropdown */}
                            <select 
                                onChange={handleTagSelect}
                                defaultValue=""
                                className={inputClasses}
                            >
                                <option value="" disabled>-- Chọn Tag --</option>
                                {availableTags.map(tag => (
                                    <option key={tag.id} value={tag.name}>
                                        {tag.name}
                                    </option>
                                ))}
                            </select>

                            {/* The Selected Tag Pills */}
                            {formData.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {formData.tags.map(tag => (
                                        <span 
                                            key={tag} 
                                            className="bg-yellow-500 text-black px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2 shadow-sm"
                                        >
                                            {tag}
                                            <button 
                                                type="button" 
                                                onClick={() => removeTag(tag)}
                                                className="hover:text-red-600 transition-colors bg-black/10 rounded-full w-5 h-5 flex items-center justify-center"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* SYNOPSIS */}
                    <div className="mb-6">
                        <label className="block text-sm font-bold mb-2 uppercase tracking-wide opacity-80">
                            Giới Thiệu Nội Dung
                        </label>
                        <textarea 
                            name="synopsis"
                            rows={4}
                            placeholder="Kể tóm tắt về câu chuyện của bạn..."
                            value={formData.synopsis}
                            onChange={handleChange}
                            className={`${inputClasses} resize-y`}
                        ></textarea>
                    </div>

                    {/* VISIBILITY & STATUS (2 Columns) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                        <div>
                            <label className="block text-sm font-bold mb-2 uppercase tracking-wide opacity-80 flex items-center gap-2">
                                <FiEye /> Quyền Xem
                            </label>
                            <select 
                                name="visibility" 
                                value={formData.visibility} 
                                onChange={handleChange}
                                className={inputClasses}
                            >
                                <option value="PUBLIC">Công Khai (Tất cả mọi người)</option>
                                <option value="MEMBERS">Thành Viên (Cần đăng nhập)</option>
                                <option value="TIERS">Trả Phí (Tier)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-2 uppercase tracking-wide opacity-80 flex items-center gap-2">
                                <FiSettings /> Trạng Thái
                            </label>
                            {/* 4. Updated name to 'status' */}
                            <select 
                                name="status" 
                                value={formData.status} 
                                onChange={handleChange}
                                className={inputClasses}
                            >
                                <option value="DRAFT">Bản Nháp (Chưa xuất bản)</option>
                                <option value="PUBLISHED">Xuất Bản (Hiển thị ngay)</option>
                                <option value="HIDDEN">Ẩn</option>
                            </select>
                        </div>
                    </div>

                    {/* SUBMIT BUTTON */}
                    <button 
                        type="submit" 
                        disabled={isCreatingBook || !formData.title.trim()}
                        className={`w-full py-4 rounded-xl font-black text-lg flex items-center justify-center gap-2 transition-all
                            ${isCreatingBook || !formData.title.trim()
                                ? isDark 
                                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                                    : 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                                : 'bg-yellow-500 text-gray-900 hover:bg-yellow-400 shadow-lg hover:shadow-yellow-500/30 active:scale-[0.98]'
                            }`}
                    >
                        {isCreatingBook ? (
                            <span className="animate-pulse">Đang Tạo Truyện...</span>
                        ) : (
                            <>
                                <FiCheckCircle className="text-xl" /> Tạo Truyện Mới
                            </>
                        )}
                    </button>

                </form>
            </div>
        </div>
    );
};

export default CreateBookPage;