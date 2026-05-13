export interface User {
  id: string;
  email?: string;
  user_metadata?: { full_name?: string };
}

export interface Profile {
  id: string;
  email: string;
  full_name?: string;
  pgy?: string;
  role?: 'resident' | 'faculty' | 'admin';
  advisor?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Question {
  id: string;
  question_text: string;
  answer_a?: string;
  answer_b?: string;
  answer_c?: string;
  answer_d?: string;
  answer_e?: string;
  options?: string[]; // Sometimes options are an array
  correct_index: number;
  explanation?: string;
  category: string;
  year?: string;
  keyword?: string;
}

export interface Result {
  id?: string;
  user_id: string;
  legacy_email?: string;
  topic: string;
  score: number;
  total: number;
  percentage: number;
  academic_points: number;
  timing_status?: string;
  created_at?: string;
}

export interface Block {
  id: string;
  title: string;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
  block_type?: string;
  question_ids?: string[];
}

export interface QuizSession {
  id: string;
  user_id: string;
  quiz_id?: string;
  topic: string;
  current_index: number;
  answers: Record<number, number>;
  time_left: number;
  questions: Question[];
  is_completed: boolean;
  last_updated?: string;
}
