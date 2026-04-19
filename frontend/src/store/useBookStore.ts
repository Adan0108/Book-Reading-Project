import { create } from 'zustand';
import { toast } from 'sonner';
import { bookService } from '../services/bookService';
import type { Book, BookDetail, Chapter, BookQueryParams, CreateBookPayload, UpdateBookPayload, CreateChapterPayload, UpdateChapterPayload, AuthorBooksQueryParams } from '../type/book';

interface BookState {
    // Data State
    books: Book[];
    currentBook: BookDetail | null;
    currentChapter: Chapter | null;
    currentBookChapters: Chapter[]; // For TOC
    totalPages: number;
    authorBooks: any[]

    // Loading Flags
    isLoadingBooks: boolean;
    isLoadingBookDetail: boolean;
    isLoadingChapter: boolean;
    isCreatingBook: boolean;
    isUpdatingBook: boolean;
    isCreatingChapter: boolean;
    isUpdatingChapter: boolean;
    isFetchingAuthorBooks: boolean
    isFetchingBook: boolean;
    isFetchingChapter: boolean;

    // Actions
    fetchBooks: (params?: BookQueryParams) => Promise<void>;
    fetchBookBySlug: (slug: string) => Promise<void>;
    fetchChapterContent: (slug: string, chapterNo: number) => Promise<void>;
    fetchBookChapters: (slug: string) => Promise<void>;
    fetchAuthorBooks: (authorId: number, params?: BookQueryParams) => Promise<void>;
    fetchAuthorBooksDashBoard: (params?: AuthorBooksQueryParams) => Promise<void>;
    fetchAuthorBookDetail: (bookId: number) => Promise<void>;
    fetchAuthorChapterDetail: (bookId: number, chapterId: number) => Promise<any>;

    createNewBook: (data: CreateBookPayload) => Promise<boolean>;
    updateBookDetails: (bookId: number, data: UpdateBookPayload) => Promise<string | false>;
    createNewChapter: (bookId: number, data: CreateChapterPayload) => Promise<boolean>;
    updateChapterDetails: (bookId: number, chapterId: number, data: UpdateChapterPayload) => Promise<boolean>;
}

export const useBookStore = create<BookState>()((set, get) => ({
    books: [],
    currentBook: null,
    currentChapter: null,
    currentBookChapters: [],
    totalPages: 0,
    authorBooks: [],

    isLoadingBooks: false,
    isLoadingBookDetail: false,
    isLoadingChapter: false,
    isFetchingAuthorBooks: false,
    isFetchingChapter: false,

    isCreatingBook: false,
    isUpdatingBook: false,
    isCreatingChapter: false,
    isUpdatingChapter: false,
    isFetchingBook: false,

    fetchBooks: async (params) => {
        set({ isLoadingBooks: true });
        try {
            const response = await bookService.getBooks(params);

            const limit = response.metadata.limit || 20; 
            const calculatedTotalPages = Math.ceil(response.metadata.total / limit);

            set({ 
                books: response.metadata.items,
                totalPages: calculatedTotalPages
            });
        } catch (error) {
            console.error('Fetch books error:', error);
            toast.error('Failed to load books.');
        } finally {
            set({ isLoadingBooks: false });
        }
    },

    fetchBookBySlug: async (slug) => {
        set({ isLoadingBookDetail: true, currentBook: null }); // Clear previous book while loading
        try {
            const bookData = await bookService.getBookBySlug(slug);
            
            console.log("Book Detail Response:", bookData);
            
            set({ currentBook: bookData });
        } catch (error) {
            console.error('Fetch book detail error:', error);
            toast.error('Failed to load book details.');
        } finally {
            set({ isLoadingBookDetail: false });
        }
    },

    fetchBookChapters: async (slug) => {
        // Typically fetching TOC is fast, but we can reuse the book detail loading flag or add a new one
        try {
            const chapters = await bookService.getBookChapters(slug);
            set({ currentBookChapters: chapters });
        } catch (error) {
            console.error('Fetch chapters error:', error);
            toast.error('Failed to load table of contents.');
        }
    },

    fetchChapterContent: async (slug, chapterNo) => {
        set({ isLoadingChapter: true, currentChapter: null }); 
        try {
            
            const chapterData = await bookService.getChapterContent(slug, chapterNo);
            
            console.log("Chapter Content Response:", chapterData);
            
            set({ currentChapter: chapterData });
        } catch (error: any) {
            console.error('Fetch chapter content error:', error);
            
            if (error.response?.status === 403) {
                // toast.error('Chương này yêu cầu mở khóa hoặc đăng nhập!');
            }
        } finally {
            set({ isLoadingChapter: false });
        }
    },

    fetchAuthorBooks: async (authorId, params) => {
        set({ isLoadingBooks: true });
        try {
            const response = await bookService.getAuthorBooks(authorId, params);

            const limit = response.metadata.limit || 20;
            const calculatedTotalPages = Math.ceil(response.metadata.total / limit);

            console.log("Author Books Response:", response);

            set({ 
                books: response.metadata.items,
                totalPages: calculatedTotalPages
            });
        } catch (error) {
            console.error('Fetch author books error:', error);
            toast.error("Failed to load author's books.");
        } finally {
            set({ isLoadingBooks: false });
        }
    },

    createNewBook: async (data) => {
        set({ isCreatingBook: true });
        try {
            const newBook = await bookService.createBook(data);
            console.log("Book created successfully:", newBook);
            return true; // Return true so the UI knows to redirect the user
        } catch (error: any) {
            console.error("Create book error:", error.response?.data);
            return false;
        } finally {
            set({ isCreatingBook: false });
        }
    },

    updateBookDetails: async (bookId, data) => {
        set({ isUpdatingBook: true });
        try {
            const updatedBook = await bookService.updateBook(bookId, data);
            console.log("Book updated successfully:", updatedBook);

            const currentBook = get().currentBook;
            if (currentBook && currentBook.id === bookId) {
                set({ currentBook: { ...currentBook, ...data } as any }); 
            }

            const finalSlug = updatedBook.slug || data.slug || currentBook?.slug;
            return finalSlug || false;
        }
        catch (error: any) {
            console.error("Update book error:", error.response?.data || error);
            return false;
        }
        finally {
            set({ isUpdatingBook: false });
        }
    },

    createNewChapter: async (bookId, data) => {
        set({ isCreatingChapter: true });

        try {
            const newChapter = await bookService.createChapter(bookId, data);
            console.log("Chapter created successfully:", newChapter);
            return true;
        } catch (error: any) {
            console.error("Create chapter error:", error.response?.data || error);
            return false;
        } finally {
            set({ isCreatingChapter: false });
        }
    },

    updateChapterDetails: async (bookId, chapterId, data) => {
        set({ isUpdatingChapter: true });
        try {
            await bookService.updateChapter(bookId, chapterId, data);
            console.log("Chapter updated successfully");
            return true;
        } catch (error: any) {
            console.error("Update chapter error:", error.response?.data || error);
            return false;
        } finally {
            set({ isUpdatingChapter: false });
        }
    },

    fetchAuthorBooksDashBoard: async (params) => {
        set({ isFetchingAuthorBooks: true });
        try {
            const data = await bookService.getAuthorBooksQuery(params);
            const booksArray = Array.isArray(data) ? data : (data.books || data.items || []);

            set({ authorBooks: booksArray });
            console.log("Author books fetched successfully:", booksArray);
        } catch (error: any) {
            console.error("Fetch author books error:", error.response?.data || error);
            set({ authorBooks: [] });
        } finally {
            set({ isFetchingAuthorBooks: false });
        }
    },

    fetchAuthorBookDetail: async (bookId: number) => {
        set({ isFetchingBook: true });
        try {
            const data = await bookService.getAuthorBookDetail(bookId);
            const bookData = data.metadata ? data.metadata : data;
            
            set({ currentBook: bookData });
            console.log("Fetched Author Book:", bookData);
        } catch (error: any) {
            console.error("Fetch author book detail error:", error);
            set({ currentBook: null });
        } finally {
            set({ isFetchingBook: false });
        }
    },

    fetchAuthorChapterDetail: async (bookId: number, chapterId: number) => {
        set({ isFetchingChapter: true });
        try {
            const data = await bookService.getAuthorChapterDetail(bookId, chapterId);
            const chapterData = data.metadata ? data.metadata : data;

            set({ currentChapter: chapterData });
            return chapterData
        } catch (error) {
            console.error("Fetch author chapter detail error:", error);
            set({ currentChapter: null });
            return null;
        } finally {
            set({ isFetchingChapter: false });
        }
    }

}));