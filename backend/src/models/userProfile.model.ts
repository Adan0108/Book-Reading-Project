export interface UserProfile {
  user_id: number;       // PK & FK -> users.id
  username: string;
  nickname?: string | null;
  avatar_url?: string | null;
  mobile?: string | null;
  gender?: number | null;
  birthday?: string | null; // 'YYYY-MM-DD'
  is_private: 0 | 1;
  bio_description?: string | null;
  deleted_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}
