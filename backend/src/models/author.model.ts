export interface Author {
  id: number;
  user_id: number;   // unique FK -> users.id
  pen_name?: string | null;
  is_approved: 0 | 1;
  created_at: Date;
  updated_at: Date;
}
