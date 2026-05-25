export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          created_at: string | null
          date: string
          id: string
          points: number | null
          resident_email: string | null
          resident_name: string | null
          status: string | null
          topic: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          points?: number | null
          resident_email?: string | null
          resident_name?: string | null
          status?: string | null
          topic?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          points?: number | null
          resident_email?: string | null
          resident_name?: string | null
          status?: string | null
          topic?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      authorized_roster: {
        Row: {
          advisor: string | null
          cohort_year: number | null
          email: string
          first_name: string | null
          graduated_year: number | null
          last_name: string | null
          name: string | null
          pgy: string | null
          pgy_override: number | null
          role: string | null
          status: string | null
          track: string | null
        }
        Insert: {
          advisor?: string | null
          cohort_year?: number | null
          email: string
          first_name?: string | null
          graduated_year?: number | null
          last_name?: string | null
          name?: string | null
          pgy?: string | null
          pgy_override?: number | null
          role?: string | null
          status?: string | null
          track?: string | null
        }
        Update: {
          advisor?: string | null
          cohort_year?: number | null
          email?: string
          first_name?: string | null
          graduated_year?: number | null
          last_name?: string | null
          name?: string | null
          pgy?: string | null
          pgy_override?: number | null
          role?: string | null
          status?: string | null
          track?: string | null
        }
        Relationships: []
      }
      badges: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          type: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          type?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          type?: string | null
        }
        Relationships: []
      }
      block_schedule: {
        Row: {
          block_id: string | null
          end_date: string
          id: string
          start_date: string
        }
        Insert: {
          block_id?: string | null
          end_date: string
          id?: string
          start_date: string
        }
        Update: {
          block_id?: string | null
          end_date?: string
          id?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "block_schedule_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          academic_year: string | null
          block_type: string | null
          category_filters: Json | null
          description: string | null
          id: string
          is_archived: boolean | null
          keyword_filters: Json | null
          last_updated: string | null
          question_count: number | null
          question_ids: Json | null
          sort_order: number | null
          tab_name: string | null
          title: string
        }
        Insert: {
          academic_year?: string | null
          block_type?: string | null
          category_filters?: Json | null
          description?: string | null
          id: string
          is_archived?: boolean | null
          keyword_filters?: Json | null
          last_updated?: string | null
          question_count?: number | null
          question_ids?: Json | null
          sort_order?: number | null
          tab_name?: string | null
          title: string
        }
        Update: {
          academic_year?: string | null
          block_type?: string | null
          category_filters?: Json | null
          description?: string | null
          id?: string
          is_archived?: boolean | null
          keyword_filters?: Json | null
          last_updated?: string | null
          question_count?: number | null
          question_ids?: Json | null
          sort_order?: number | null
          tab_name?: string | null
          title?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          advisor: string | null
          created_at: string | null
          email: string | null
          first_name: string | null
          full_name: string | null
          id: string
          last_name: string | null
          pgy: string | null
          role: string | null
        }
        Insert: {
          advisor?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id: string
          last_name?: string | null
          pgy?: string | null
          role?: string | null
        }
        Update: {
          advisor?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          pgy?: string | null
          role?: string | null
        }
        Relationships: []
      }
      qotd_reactions: {
        Row: {
          created_at: string
          date: string
          id: string
          question_id: string
          reaction: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          question_id: string
          reaction: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          question_id?: string
          reaction?: string
          user_id?: string | null
        }
        Relationships: []
      }
      question_attempts: {
        Row: {
          created_at: string | null
          id: string
          is_correct: boolean
          is_qotd: boolean | null
          question_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_correct: boolean
          is_qotd?: boolean | null
          question_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_correct?: boolean
          is_qotd?: boolean | null
          question_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      questions: {
        Row: {
          abfm_category: string | null
          category: string | null
          correct_index: number
          created_at: string | null
          difficulty: number | null
          explanation: string | null
          id: string
          options: Json
          question_text: string
          resource_link: string | null
          system: string | null
          year: string | null
        }
        Insert: {
          abfm_category?: string | null
          category?: string | null
          correct_index: number
          created_at?: string | null
          difficulty?: number | null
          explanation?: string | null
          id?: string
          options: Json
          question_text: string
          resource_link?: string | null
          system?: string | null
          year?: string | null
        }
        Update: {
          abfm_category?: string | null
          category?: string | null
          correct_index?: number
          created_at?: string | null
          difficulty?: number | null
          explanation?: string | null
          id?: string
          options?: Json
          question_text?: string
          resource_link?: string | null
          system?: string | null
          year?: string | null
        }
        Relationships: []
      }
      quiz_sessions: {
        Row: {
          answers: Json | null
          current_index: number | null
          id: string
          is_completed: boolean | null
          last_updated: string | null
          questions: Json | null
          quiz_id: string | null
          time_left: number | null
          topic: string | null
          user_id: string
        }
        Insert: {
          answers?: Json | null
          current_index?: number | null
          id?: string
          is_completed?: boolean | null
          last_updated?: string | null
          questions?: Json | null
          quiz_id?: string | null
          time_left?: number | null
          topic?: string | null
          user_id: string
        }
        Update: {
          answers?: Json | null
          current_index?: number | null
          id?: string
          is_completed?: boolean | null
          last_updated?: string | null
          questions?: Json | null
          quiz_id?: string | null
          time_left?: number | null
          topic?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_sessions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          question_ids: string[] | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          question_ids?: string[] | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          question_ids?: string[] | null
          title?: string
        }
        Relationships: []
      }
      results: {
        Row: {
          academic_points: number | null
          academic_year: number | null
          answers: Json | null
          category_stats: Json | null
          created_at: string | null
          id: string
          legacy_email: string | null
          percentage: number | null
          quiz_id: string | null
          score: number | null
          timing_status: string | null
          topic: string | null
          total: number | null
          user_id: string | null
        }
        Insert: {
          academic_points?: number | null
          academic_year?: number | null
          answers?: Json | null
          category_stats?: Json | null
          created_at?: string | null
          id?: string
          legacy_email?: string | null
          percentage?: number | null
          quiz_id?: string | null
          score?: number | null
          timing_status?: string | null
          topic?: string | null
          total?: number | null
          user_id?: string | null
        }
        Update: {
          academic_points?: number | null
          academic_year?: number | null
          answers?: Json | null
          category_stats?: Json | null
          created_at?: string | null
          id?: string
          legacy_email?: string | null
          percentage?: number | null
          quiz_id?: string | null
          score?: number | null
          timing_status?: string | null
          topic?: string | null
          total?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "results_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_id: string | null
          earned_at: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          badge_id?: string | null
          earned_at?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          badge_id?: string | null
          earned_at?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_streaks: {
        Row: {
          current_block_streak: number | null
          current_qotd_correct_streak: number | null
          current_qotd_streak: number | null
          last_block_date: string | null
          last_qotd_date: string | null
          max_block_streak: number | null
          max_qotd_correct_streak: number | null
          max_qotd_streak: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          current_block_streak?: number | null
          current_qotd_correct_streak?: number | null
          current_qotd_streak?: number | null
          last_block_date?: string | null
          last_qotd_date?: string | null
          max_block_streak?: number | null
          max_qotd_correct_streak?: number | null
          max_qotd_streak?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          current_block_streak?: number | null
          current_qotd_correct_streak?: number | null
          current_qotd_streak?: number | null
          last_block_date?: string | null
          last_qotd_date?: string | null
          max_block_streak?: number | null
          max_qotd_correct_streak?: number | null
          max_qotd_streak?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      web_push_subscriptions: {
        Row: {
          auth: string | null
          created_at: string
          endpoint: string
          id: string
          legacy_email: string | null
          p256dh: string | null
          user_id: string | null
        }
        Insert: {
          auth?: string | null
          created_at?: string
          endpoint: string
          id?: string
          legacy_email?: string | null
          p256dh?: string | null
          user_id?: string | null
        }
        Update: {
          auth?: string | null
          created_at?: string
          endpoint?: string
          id?: string
          legacy_email?: string | null
          p256dh?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin_or_faculty: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
