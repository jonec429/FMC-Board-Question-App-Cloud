import { Database } from './database.types';
import { User as SupabaseUser } from '@supabase/supabase-js';

export type User = SupabaseUser;

export type Profile = Database['public']['Tables']['profiles']['Row'] & {
  view_as?: 'resident' | 'faculty' | 'admin' | null;
  notification_preferences?: {
    qotd?: boolean;
    qotd_reminder?: boolean;
    block_reminders?: boolean;
    faculty_digest?: boolean;
    [key: string]: boolean | undefined;
  } | null;
};
export type RosterEntry = Database['public']['Tables']['authorized_roster']['Row'];
export type Question = Omit<Database['public']['Tables']['questions']['Row'], 'options'> & {
  options: string[];
  is_repeat?: boolean | null;
};
export type Block = Omit<Database['public']['Tables']['blocks']['Row'], 'question_ids' | 'category_filters' | 'keyword_filters'> & {
  question_ids: string[] | null;
  category_filters: string[] | null;
  keyword_filters: string[] | null;
};
export type BlockSchedule = Database['public']['Tables']['block_schedule']['Row'];
export interface ReviewDataItem {
  q: string;
  a?: number | string | null;
  status?: string;
  explanation?: string;
  submitted_answer?: string;
}

export type Result = Database['public']['Tables']['results']['Row'] & {
  review_data?: ReviewDataItem[] | null;
  attendance_date?: string | null;
};
export type Badge = Database['public']['Tables']['badges']['Row'];
export type UserBadge = Database['public']['Tables']['user_badges']['Row'] & {
  name?: string;
  icon?: string | null;
  description?: string | null;
  type?: string | null;
  badges?: Database['public']['Tables']['badges']['Row'] | null;
};
export type QuestionAttempt = Database['public']['Tables']['question_attempts']['Row'];
export type AttendanceRecord = Database['public']['Tables']['attendance']['Row'];

export interface LeaderboardEntry {
  email: string;
  name: string;
  pgy: string;
  totalPoints: number;
  totalQs: number;
  yoyStats?: Record<number, number>;
}

export interface AdminData {
  questions: Question[];
  blocks: Block[];
  block_schedule: BlockSchedule[];
  results: Result[];
  profiles: Profile[];
  roster: RosterEntry[];
  attendance: AttendanceRecord[];
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

export interface AssignedQuiz {
  id: string;
  created_at?: string;
  assigned_by: string;
  assigned_to: string;
  title: string;
  question_ids: string[];
  is_completed: boolean;
  completed_at?: string | null;
}
