export interface UserKeys {
  user_id: number;       // PK & FK -> users.id
  public_key: string;
  private_key: string;   // consider KMS later
  created_at: Date;
  updated_at: Date;
}
