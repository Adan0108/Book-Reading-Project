export type AuthorApplicationStatus =
  | "PENDING"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "WITHDRAWN";

export interface AuthorApplication {
  id: number;
  user_id: number;

  pen_name: string | null;
  application_title: string;
  sample_title: string;
  sample_story: string;
  bio: string | null;
  motivation: string | null;
  genres_json: any | null;
  portfolio_links_json: any | null;
  extra_json: any | null;

  status: AuthorApplicationStatus;
  submitted_at: Date;

  reviewed_by: number | null;
  reviewed_at: Date | null;
  decision_reason: string | null;
  internal_notes: string | null;

  spam_score: string | null; // mysql2 returns DECIMAL as string often
  quality_score: string | null;
  ai_flags_json: any | null;
  ai_last_scored_at: Date | null;

  submit_ip: string | null;
  submit_user_agent: string | null;

  created_at: Date;
  updated_at: Date;
}