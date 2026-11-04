export interface StorySummary {
  id: number;
  slug: string;
  title: string;
  genre: string;
  synopsis: string | null;
  coverUrl: string | null;
  authorId: number;
  authorName: string;
  visibility: string;
  totalChapters: number;
  viewsCount: number;
  hasMembersOnlyChapters: boolean;
}
export interface StoryDetail {
  id: number;
  slug: string;
  title: string;
  genre: string;
  synopsis: string | null;
  coverUrl: string | null;
  visibility: string;
  viewsCount: number;
  authorProfile: { id: number; penName: string };
  tags: { id: number; name: string; slug: string }[];
  totalChapters: number;
  hasFreeChapters: boolean;
  hasMembersOnlyChapters: boolean;
}
export interface PublicAuthor {
  id: number;
  penName: string;
  bio: string;
  bookCount: number;
  followerCount: number;
  isFollowing: boolean;
  isOwner: boolean;
}
