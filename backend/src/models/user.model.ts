export interface User {
  id: number;
  email: string;
  password_hash: string;
  state: 0 | 1;
  created_at: Date;
  updated_at: Date;
}
