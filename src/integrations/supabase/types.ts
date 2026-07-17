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
      audit_events: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          created_at: string
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          new_value: Json | null
          old_value: Json | null
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Relationships: []
      }
      candidate_documents: {
        Row: {
          candidate_id: string
          created_at: string
          document_type: string
          expiry_date: string | null
          extracted_fields: Json
          file_name: string
          id: string
          mime_type: string | null
          ocr_complete: boolean
          ocr_confidence: number | null
          size_bytes: number | null
          storage_path: string
          updated_at: string
          uploaded_by: string | null
          verified: boolean
          verified_at: string | null
          verified_by: string | null
          version: number
        }
        Insert: {
          candidate_id: string
          created_at?: string
          document_type?: string
          expiry_date?: string | null
          extracted_fields?: Json
          file_name: string
          id?: string
          mime_type?: string | null
          ocr_complete?: boolean
          ocr_confidence?: number | null
          size_bytes?: number | null
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
          version?: number
        }
        Update: {
          candidate_id?: string
          created_at?: string
          document_type?: string
          expiry_date?: string | null
          extracted_fields?: Json
          file_name?: string
          id?: string
          mime_type?: string | null
          ocr_complete?: boolean
          ocr_confidence?: number | null
          size_bytes?: number | null
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "candidate_documents_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["candidate_id"]
          },
        ]
      }
      candidates: {
        Row: {
          assigned_recruiter_id: string | null
          assigned_recruiter_name: string | null
          batch_id: string | null
          candidate_id: string
          country: string
          created_at: string
          created_by: string | null
          dob: string | null
          email: string
          extracted_fields: Json
          first_name: string
          gate_status: string
          gender: string | null
          highest_qualification: string | null
          is_mock: boolean
          last_name: string
          phone: string
          product_id: string
          program_name: string | null
          rank: number | null
          source_agency_id: string | null
          source_agency_name: string | null
          source_type: string
          status: string
          total_score: number | null
          updated_at: string
          verification_state: Json
        }
        Insert: {
          assigned_recruiter_id?: string | null
          assigned_recruiter_name?: string | null
          batch_id?: string | null
          candidate_id?: string
          country?: string
          created_at?: string
          created_by?: string | null
          dob?: string | null
          email?: string
          extracted_fields?: Json
          first_name: string
          gate_status?: string
          gender?: string | null
          highest_qualification?: string | null
          is_mock?: boolean
          last_name: string
          phone?: string
          product_id: string
          program_name?: string | null
          rank?: number | null
          source_agency_id?: string | null
          source_agency_name?: string | null
          source_type?: string
          status?: string
          total_score?: number | null
          updated_at?: string
          verification_state?: Json
        }
        Update: {
          assigned_recruiter_id?: string | null
          assigned_recruiter_name?: string | null
          batch_id?: string | null
          candidate_id?: string
          country?: string
          created_at?: string
          created_by?: string | null
          dob?: string | null
          email?: string
          extracted_fields?: Json
          first_name?: string
          gate_status?: string
          gender?: string | null
          highest_qualification?: string | null
          is_mock?: boolean
          last_name?: string
          phone?: string
          product_id?: string
          program_name?: string | null
          rank?: number | null
          source_agency_id?: string | null
          source_agency_name?: string | null
          source_type?: string
          status?: string
          total_score?: number | null
          updated_at?: string
          verification_state?: Json
        }
        Relationships: [
          {
            foreignKeyName: "candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "intake_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_batches: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          mode: string
          product_id: string
          resume_state: Json
          status: string
          total_candidates: number
          total_files: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          mode?: string
          product_id: string
          resume_state?: Json
          status?: string
          total_candidates?: number
          total_files?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          mode?: string
          product_id?: string
          resume_state?: Json
          status?: string
          total_candidates?: number
          total_files?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
