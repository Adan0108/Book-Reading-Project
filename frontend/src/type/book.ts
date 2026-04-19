export interface ApiResponse<T> {
    message: string;
    status: number;
    metadata: T;
}

export interface Book {
    id: number;
    authorProfile?: AuthorProfile;
    slug: string;
    genre?: string;
    visibility?: string;
    status?: string;
    title: string;
    synopsis: string;
    coverUrl: string;
    authorName: string;
    tags?: string[];
    totalChapters: number;
    hasMembersChapters?: boolean; 
    hasTierChapters?: boolean;
}

export interface BookDetail extends Book {
    authorProfile: AuthorProfile; 
    publishStatus: string;
    hasPublicChapters: boolean;
}

export interface Chapter {
    id: number;
    index: number;
    title: string;
    visibility: 'PUBLIC' | 'MEMBERS' | 'TIERS';
    scheduledAt?: string;
    publishedAt?: string;
    isDraft: boolean;
    contentMarkdown?: string; 
    isLockedForCurrentUser?: boolean;
}

export interface BookQueryParams {
    query?: string;
    page?: number;
    limit?: number;
    sort?: string;
}

export interface PaginatedResponse<T> {
    message: string;
    status: number;
    metadata: {
        items: T[];    // <-- The books are actually inside 'items' here!
        total: number;
        page: number;
        limit: number;
    };
}

export interface AuthorProfile {
    id: number;
    penName: string;
}

// Author API response structure //

// Creating a new book
export interface CreateBookPayload {
    title: string;          // Required
    slug?: string;          // Optional
    genre?: string;
    synopsis?: string;      // Optional
    tags?: string[];        // Optional
    coverUrl?: string;      // Optional
    visibility?: 'PUBLIC' | 'MEMBERS' | 'TIERS';     // Optional (Default: PUBLIC)
    status?: 'DRAFT' | 'PUBLISHED' | 'HIDDEN'; // Optional (Default: DRAFT)
}

export interface UpdateBookPayload {
    title?: string;          
    slug?: string;          
    genre?: string;         
    synopsis?: string;      
    tags?: string[];        
    coverUrl?: string;      
    visibility?: 'PUBLIC' | 'MEMBERS' | 'TIERS';     
    status?: 'DRAFT' | 'PUBLISHED' | 'HIDDEN'; 
}

export interface CreateChapterPayload {
    title: string;              
    contentMd: string;          
    visibility?: 'PUBLIC' | 'MEMBERS' | 'TIERS'; 
    scheduledAt?: string;       
    isDraft?: number;           
}

export interface UpdateChapterPayload {
    title?: string;
    contentMd?: string;
    visibility?: 'PUBLIC' | 'MEMBERS' | 'TIERS';
    scheduledAt?: string;
    isDraft?: number;
}

export interface AuthorBooksQueryParams {
    query?: string
    status?: 'DRAFT' | 'PUBLISHED' | 'HIDDEN'
    visibility?: 'PUBLIC' | 'MEMBERS' | 'TIERS'
    page?: number
    limit?: number
}