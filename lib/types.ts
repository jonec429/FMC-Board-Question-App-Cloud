export interface User {
  id: string;
  email?: string;
  user_metadata?: { full_name?: string };
}

export interface Profile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  streak_count: number;
  streak_last_date?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RosterEntry {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  pgy: string;
  cohort_year?: number;
  track?: string;
  pgy_override?: number;
  status?: string;
  graduated_year?: number;
  created_at?: string;
}

export interface Question {
  id: string;
  question_text: string;
  category: string;
  year?: string;
  options: string[];
  correct_index: number;
  explanation?: string;
  resource_link?: string;
}

export interface Block {
  id: string;
  title: string;
  curriculum_year?: string;
  status?: string;
  is_archived?: boolean;
  question_ids?: string[];
  created_at?: string;
}

export interface BlockSchedule {
  id: string;
  block_id: string;
  resident_email: string;
  start_date: string;
  end_date: string;
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
  missed_questions?: any[];
}

export interface AdminData {
  questions: Question[];
  blocks: Block[];
  block_schedule: BlockSchedule[];
  results: Result[];
  profiles: Profile[];
  roster: RosterEntry[];
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
