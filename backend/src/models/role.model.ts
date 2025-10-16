export interface Role {
  id: number;
  code: "READER" | "AUTHOR" | "ADMIN"; // keep literal union for safety
  name: string;
  created_at: Date;
}
