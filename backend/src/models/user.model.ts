export interface User {
  id: number;
  email: string;
  password_hash: string;
  state: 0 | 1 | 2; // 0: inactive, 1: active, 2: pending password
  created_at: Date;
  updated_at: Date;
}
