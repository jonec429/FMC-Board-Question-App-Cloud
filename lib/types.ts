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

export interface QotdOptionDistribution {
  count: number;
  pct: number;
}

export interface QotdPeerComparisonResponse {
  questionStats: {
    questionId: string;
    totalResponders: number;
    correctCount: number;
    incorrectCount: number;
    accuracyPct: number;
    optionCounts: Record<number, QotdOptionDistribution>;
  } | null;
  programStats: {
    totalProgramParticipants: number;
    totalAttempts: number;
    programAccuracyPct: number;
    medianStreak: number;
  };
  personalStats: {
    totalAttempts: number;
    correctCount: number;
    accuracyPct: number;
    currentStreak: number;
    maxStreak: number;
  } | null;
}

export interface QotdDailyRespondent {
  userId: string;
  name: string;
  email: string;
  pgy: string;
  isCorrect: boolean;
  selectedIndex: number | null;
  answeredAt: string;
}

export interface QotdDailyStatItem {
  date: string;
  questionId: string;
  questionText: string;
  category: string;
  year: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  attemptsCount: number;
  correctCount: number;
  accuracy: number;
  optionCounts: Record<number, QotdOptionDistribution>;
  reactions: Record<string, number>;
  respondents: QotdDailyRespondent[];
  pendingResidents: Array<{ name: string; email: string; pgy: string }>;
}

export interface QotdResidentStatItem {
  userId: string | null;
  email: string;
  name: string;
  pgy: string;
  advisor: string;
  attemptsCount: number;
  correctCount: number;
  accuracy: number;
  participationRate: number;
  currentStreak: number;
  maxStreak: number;
  lastAnsweredDate: string | null;
}

export interface QotdCategoryStatItem {
  category: string;
  totalQuestions: number;
  totalAttempts: number;
  correctCount: number;
  accuracy: number;
}

export interface QotdPgyStatItem {
  pgy: string;
  totalResidents: number;
  totalAttempts: number;
  averageAttemptsPerResident: number;
  accuracyRate: number;
  participationRate: number;
}

export interface QotdAnalyticsResponse {
  kpis: {
    totalAttempts: number;
    totalQuestionsServed: number;
    overallAccuracy: number;
    distinctParticipants: number;
    activeResidentCount: number;
    averageDailyParticipationRate: number;
    activeMonthReachPct: number;
    activeMonthReachCount: number;
  };
  pgyCohorts: QotdPgyStatItem[];
  categories: QotdCategoryStatItem[];
  dailySchedule: QotdDailyStatItem[];
  residentStats: QotdResidentStatItem[];
}

export interface ResidentQotdHistoryItem {
  id: string;
  date: string;
  questionId: string;
  questionText: string;
  category: string;
  year: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  selectedIndex: number | null;
  isCorrect: boolean;
  answeredAt: string;
  peerAccuracyPct: number;
  peerTotalCount: number;
  peerOptionAgreementPct: number;
  peerOptionAgreementCount: number;
}

export interface BlockAuditItem {
  title: string;
  isCompleted: boolean;
  timingStatus?: string | null;
  score?: number | null;
  total?: number | null;
  percentage?: number | null;
  academicPoints?: number;
  completedAt?: string | null;
}

export interface ChallengeResidentStanding {
  userId: string | null;
  email: string;
  name: string;
  pgy: string;
  // Block completion & eligibility
  completedBlocksCount: number;
  totalRequiredBlocks: number;
  isEligible: boolean;
  completedBlockTitles: string[];
  missingBlockTitles: string[];
  blockAudit: BlockAuditItem[];
  // Challenge 1: APs (block + attendance + manual)
  totalAp: number;
  blockPoints: number;
  attendancePoints: number;
  manualPoints: number;
  rankAp: number;
  eligibleRankAp: number | null;
  // Challenge 2: Most QOTDs Completed
  qotdCompletedCount: number;
  rankQotd: number;
  eligibleRankQotd: number | null;
  // Challenge 3: Longest QOTD Streak
  longestStreak: number;
  currentStreak: number;
  rankStreak: number;
  eligibleRankStreak: number | null;
  // Projected Prize Winnings ($50 each, cumulative)
  potentialWinnings: number;
  winningCategories: string[];
}

export interface ChallengeStandingsResponse {
  academicYear: number;
  totalRequiredBlocks: number;
  requiredBlockTitles: string[];
  standings: ChallengeResidentStanding[];
  eligibleCount: number;
  totalResidentCount: number;
  leaders: {
    ap: {
      overall: ChallengeResidentStanding | null;
      eligible: ChallengeResidentStanding | null;
      top3Eligible: ChallengeResidentStanding[];
      top3Overall: ChallengeResidentStanding[];
    };
    qotd: {
      overall: ChallengeResidentStanding | null;
      eligible: ChallengeResidentStanding | null;
      top3Eligible: ChallengeResidentStanding[];
      top3Overall: ChallengeResidentStanding[];
    };
    streak: {
      overall: ChallengeResidentStanding | null;
      eligible: ChallengeResidentStanding | null;
      top3Eligible: ChallengeResidentStanding[];
      top3Overall: ChallengeResidentStanding[];
    };
  };
}

