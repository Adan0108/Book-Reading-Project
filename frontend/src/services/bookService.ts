import api from "../lib/axios";
import type { Book, BookDetail, Chapter, BookQueryParams, PaginatedResponse, ApiResponse, CreateBookPayload, UpdateBookPayload, CreateChapterPayload, UpdateChapterPayload, AuthorBooksQueryParams } from "../type/book";

export const bookService = {
    // GET /v1/api/books
    getBooks: async (params?: BookQueryParams) => {
        const res = await api.get<PaginatedResponse<Book>>('/books', { 
            params,
            withCredentials: true 
        });
        return res.data;
    },

    // GET /v1/api/books/:slug
    getBookBySlug: async (slug: string) => {
        const res = await api.get<ApiResponse<BookDetail>>(`/books/${slug}`, { 
            withCredentials: true 
        });
        return res.data.metadata;
    },

    // GET /v1/api/books/:slug/chapters/:chapterNo
    getChapterContent: async (slug: string, chapterNo: number) => {
        const res = await api.get<ApiResponse<Chapter>>(`/books/${slug}/chapters/${chapterNo}`, { 
            withCredentials: true 
        });
        return res.data.metadata;
    },

    // GET /v1/api/books/:slug/chapters
    getBookChapters: async (slug: string) => {
        const res = await api.get(`/books/${slug}/chapters`, { 
            withCredentials: true 
        });
        
        // Log it so we can see the structure!
        console.log("Chapters API Response:", res.data);

        // Safely extract the array whether it's direct, in metadata, or in metadata.items
        const data = res.data.metadata || res.data;
        return Array.isArray(data) ? data : (data.items || []);
    },

    // GET /v1/api/authors/:authorId/books
    getAuthorBooks: async (authorId: number, params?: BookQueryParams) => {
        const res = await api.get<PaginatedResponse<Book>>(`/books/${authorId}/books`, { 
            params,
            withCredentials: true 
        });
        return res.data;
    },

    // POST /authors/me/books (Protected)
    createBook: async (data: CreateBookPayload) => {
        const res = await api.post<ApiResponse<BookDetail>>('/authors/me/books', data, {
            withCredentials: true 
        });
        
        // Returns the created book's metadata
        return res.data.metadata || res.data;
    },

    // PATCH /authors/me/books/:bookId (Protected)
    updateBook: async (bookId: number, data: UpdateBookPayload) =>{
        const res = await api.patch<ApiResponse<BookDetail>>(`/authors/me/books/${bookId}`, data);

        return res.data.metadata || res.data;
    },

    // POST /authors/me/books/:bookId/chapters (Protected)
    createChapter: async (bookId: number, data: CreateChapterPayload) => {
        const res = await api.post<ApiResponse<Chapter>>(`/authors/me/books/${bookId}/chapters`, data);
        return res.data.metadata || res.data;
    },

    // PATCH /authors/me/books/:bookId/chapters/:chapterId
    updateChapter: async (bookId: number, chapterId: number, data: UpdateChapterPayload) => {
        const res = await api.patch<ApiResponse<Chapter>>(`/authors/me/books/${bookId}/chapters/${chapterId}`, data);
        return res.data.metadata || res.data;
    },

    // GET /v1/api/authors/me/books
    getAuthorBooksQuery: async (params?: AuthorBooksQueryParams) => {
        const res = await api.get(`/authors/me/books`, { params });
        return res.data.metadata || res.data
    },

    // GET /v1/api/authors/me/books/:bookId
    getAuthorBookDetail: async (bookId: number) => {
        const res = await api.get(`/authors/me/books/${bookId}`);
        return res.data.metadata || res.data;
    },

    // GET /v1/api/authors/me/books/:bookId/chapters/:chapterId
    getAuthorChapterDetail: async (bookId: number, chapterId: number) => {
        const res = await api.get(`/authors/me/books/${bookId}/chapters/${chapterId}`);
        return res.data.metadata || res.data;
    }
};