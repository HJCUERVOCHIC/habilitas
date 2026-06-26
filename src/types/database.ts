/**
 * Tipos de la base de datos Habilitas.
 *
 * Estructura equivalente a la salida de `supabase gen types typescript`, escrita
 * a mano a partir de supabase/migrations/0000_init.sql porque la generación con
 * la CLI requiere `supabase login` (token) o Docker local, no disponibles en
 * este entorno. Para regenerar canónicamente cuando haya token:
 *   SUPABASE_ACCESS_TOKEN=... npm run db:types
 * (ver scripts/gen-types.mjs). Mantener sincronizado con la migración.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          full_name: string
          profession: string | null
          city: string | null
          country: string | null
          rethus_number: string | null
          avatar_url: string | null
          role: string
          credential: string | null
          bio: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          profession?: string | null
          city?: string | null
          country?: string | null
          rethus_number?: string | null
          avatar_url?: string | null
          role?: string
          credential?: string | null
          bio?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          profession?: string | null
          city?: string | null
          country?: string | null
          rethus_number?: string | null
          avatar_url?: string | null
          role?: string
          credential?: string | null
          bio?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          id: string
          slug: string
          title: string
          subtitle: string | null
          description: string | null
          category: string
          duration_hours: number | null
          difficulty: string | null
          price_cop: number | null
          published: boolean
          instructor_id: string | null
          cert_validity_days: number
          pass_score: number
          max_attempts: number
          learning_objectives: string[]
          professional_profile: string | null
          methodology: string | null
          completion_rule: string | null
          archived_at: string | null
          published_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          title: string
          subtitle?: string | null
          description?: string | null
          category: string
          duration_hours?: number | null
          difficulty?: string | null
          price_cop?: number | null
          published?: boolean
          instructor_id?: string | null
          cert_validity_days?: number
          pass_score?: number
          max_attempts?: number
          learning_objectives?: string[]
          professional_profile?: string | null
          methodology?: string | null
          completion_rule?: string | null
          archived_at?: string | null
          published_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          title?: string
          subtitle?: string | null
          description?: string | null
          category?: string
          duration_hours?: number | null
          difficulty?: string | null
          price_cop?: number | null
          published?: boolean
          instructor_id?: string | null
          cert_validity_days?: number
          pass_score?: number
          max_attempts?: number
          learning_objectives?: string[]
          professional_profile?: string | null
          methodology?: string | null
          completion_rule?: string | null
          archived_at?: string | null
          published_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      modules: {
        Row: {
          id: string
          course_id: string
          title: string
          order_index: number
          created_at: string
        }
        Insert: {
          id?: string
          course_id: string
          title: string
          order_index: number
          created_at?: string
        }
        Update: {
          id?: string
          course_id?: string
          title?: string
          order_index?: number
          created_at?: string
        }
        Relationships: []
      }
      lessons: {
        Row: {
          id: string
          module_id: string
          title: string
          order_index: number
          content_type: string
          content_url: string | null
          content_r2_key: string | null
          duration_min: number | null
          transcript: string | null
          body_md: string | null
          content_original_name: string | null
          content_mime_type: string | null
          content_size_bytes: number | null
          created_at: string
        }
        Insert: {
          id?: string
          module_id: string
          title: string
          order_index: number
          content_type: string
          content_url?: string | null
          content_r2_key?: string | null
          duration_min?: number | null
          transcript?: string | null
          body_md?: string | null
          content_original_name?: string | null
          content_mime_type?: string | null
          content_size_bytes?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          module_id?: string
          title?: string
          order_index?: number
          content_type?: string
          content_url?: string | null
          content_r2_key?: string | null
          duration_min?: number | null
          transcript?: string | null
          body_md?: string | null
          content_original_name?: string | null
          content_mime_type?: string | null
          content_size_bytes?: number | null
          created_at?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          id: string
          user_id: string
          course_id: string
          enrolled_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          course_id: string
          enrolled_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          course_id?: string
          enrolled_at?: string
          completed_at?: string | null
        }
        Relationships: []
      }
      lesson_progress: {
        Row: {
          id: string
          user_id: string
          lesson_id: string
          completed: boolean
          completed_at: string | null
          time_spent_sec: number
          last_position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          lesson_id: string
          completed?: boolean
          completed_at?: string | null
          time_spent_sec?: number
          last_position?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          lesson_id?: string
          completed?: boolean
          completed_at?: string | null
          time_spent_sec?: number
          last_position?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      evaluations: {
        Row: {
          id: string
          course_id: string
          title: string
          duration_min: number
          instructions: string | null
          questions_per_attempt: number
          created_at: string
        }
        Insert: {
          id?: string
          course_id: string
          title?: string
          duration_min?: number
          instructions?: string | null
          questions_per_attempt?: number
          created_at?: string
        }
        Update: {
          id?: string
          course_id?: string
          title?: string
          duration_min?: number
          instructions?: string | null
          questions_per_attempt?: number
          created_at?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          id: string
          evaluation_id: string
          order_index: number
          text: string
          context: string | null
          options: Json
          correct_option: number
          feedback_correct: string | null
          feedback_wrong: string | null
          created_at: string
        }
        Insert: {
          id?: string
          evaluation_id: string
          order_index: number
          text: string
          context?: string | null
          options: Json
          correct_option: number
          feedback_correct?: string | null
          feedback_wrong?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          evaluation_id?: string
          order_index?: number
          text?: string
          context?: string | null
          options?: Json
          correct_option?: number
          feedback_correct?: string | null
          feedback_wrong?: string | null
          created_at?: string
        }
        Relationships: []
      }
      eval_attempts: {
        Row: {
          id: string
          user_id: string
          evaluation_id: string
          attempt_number: number
          score: number | null
          passed: boolean | null
          answers: Json | null
          question_ids: string[]
          time_spent_sec: number | null
          started_at: string
          submitted_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          evaluation_id: string
          attempt_number: number
          score?: number | null
          passed?: boolean | null
          answers?: Json | null
          question_ids?: string[]
          time_spent_sec?: number | null
          started_at?: string
          submitted_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          evaluation_id?: string
          attempt_number?: number
          score?: number | null
          passed?: boolean | null
          answers?: Json | null
          question_ids?: string[]
          time_spent_sec?: number | null
          started_at?: string
          submitted_at?: string | null
        }
        Relationships: []
      }
      certificates: {
        Row: {
          id: string
          cert_id: string
          user_id: string
          course_id: string
          eval_attempt_id: string | null
          score: number
          status: string
          issued_at: string
          expires_at: string
          revoked_at: string | null
          revoke_reason: string | null
          professional_name: string
          professional_profession: string | null
          instructor_name: string | null
          instructor_role: string | null
          verify_url: string | null
          duration_hours: number | null
          verification_id: string | null
        }
        Insert: {
          id?: string
          cert_id: string
          user_id: string
          course_id: string
          eval_attempt_id?: string | null
          score: number
          status?: string
          issued_at?: string
          expires_at: string
          revoked_at?: string | null
          revoke_reason?: string | null
          professional_name: string
          professional_profession?: string | null
          instructor_name?: string | null
          instructor_role?: string | null
          verify_url?: string | null
          duration_hours?: number | null
          verification_id?: string | null
        }
        Update: {
          id?: string
          cert_id?: string
          user_id?: string
          course_id?: string
          eval_attempt_id?: string | null
          score?: number
          status?: string
          issued_at?: string
          expires_at?: string
          revoked_at?: string | null
          revoke_reason?: string | null
          professional_name?: string
          professional_profession?: string | null
          instructor_name?: string | null
          instructor_role?: string | null
          verify_url?: string | null
          duration_hours?: number | null
          verification_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      course_progress: {
        Row: {
          user_id: string | null
          course_id: string | null
          lessons_completed: number | null
          lessons_total: number | null
          progress_pct: number | null
        }
        Relationships: []
      }
      instructors_public: {
        Row: {
          id: string | null
          full_name: string | null
          profession: string | null
          credential: string | null
          bio: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      generate_cert_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_certificate: {
        Args: { p_cert_id: string }
        Returns: Database['public']['Tables']['certificates']['Row']
      }
    }
    Enums: {
      [key: string]: never
    }
    CompositeTypes: {
      [key: string]: never
    }
  }
}

type PublicSchema = Database['public']

export type Tables<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Row']
export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update']
