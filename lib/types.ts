import { Database } from './database.types';

export interface User {
  id: string;
  email?: string;
  user_metadata?: { full_name?: string };
}

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type RosterEntry = Database['public']['Tables']['authorized_roster']['Row'];
export type Question = Omit<Database['public']['Tables']['questions']['Row'], 'options'> & { options: string[] };
export type Block = Omit<Database['public']['Tables']['blocks']['Row'], 'question_ids' | 'category_filters' | 'keyword_filters'> & {
  question_ids: string[] | null;
  category_filters: string[] | null;
  keyword_filters: string[] | null;
};
export type BlockSchedule = Database['public']['Tables']['block_schedule']['Row'];
export type Result = Omit<Database['public']['Tables']['results']['Row'], 'missed_questions'> & { missed_questions: any[] | null };

export interface LeaderboardEntry {
  email: string;
  name: string;
  pgy: string;
  totalPoints: number;
  totalQs: number;
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
