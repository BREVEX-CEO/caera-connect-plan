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
      activity_log: {
        Row: {
          action: string
          created_at: string
          feature_id: string | null
          id: string
          metadata: Json
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          feature_id?: string | null
          id?: string
          metadata?: Json
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          feature_id?: string | null
          id?: string
          metadata?: Json
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      browser_grants: {
        Row: {
          approved_by_grant_id: string | null
          browser_install_id: string
          created_at: string
          device_id: string
          id: string
          last_seen_at: string
          origin: string | null
          revoked_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          approved_by_grant_id?: string | null
          browser_install_id: string
          created_at?: string
          device_id: string
          id?: string
          last_seen_at?: string
          origin?: string | null
          revoked_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          approved_by_grant_id?: string | null
          browser_install_id?: string
          created_at?: string
          device_id?: string
          id?: string
          last_seen_at?: string
          origin?: string | null
          revoked_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "browser_grants_approved_by_grant_id_fkey"
            columns: ["approved_by_grant_id"]
            isOneToOne: false
            referencedRelation: "browser_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "browser_grants_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_audit_log: {
        Row: {
          action: string
          category: Database["public"]["Enums"]["compliance_category"]
          created_at: string
          feature_id: string | null
          id: string
          ip: string | null
          prev_hash: string | null
          preview: Json | null
          result: Json | null
          row_hash: string | null
          tenant_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          category?: Database["public"]["Enums"]["compliance_category"]
          created_at?: string
          feature_id?: string | null
          id?: string
          ip?: string | null
          prev_hash?: string | null
          preview?: Json | null
          result?: Json | null
          row_hash?: string | null
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          category?: Database["public"]["Enums"]["compliance_category"]
          created_at?: string
          feature_id?: string | null
          id?: string
          ip?: string | null
          prev_hash?: string | null
          preview?: Json | null
          result?: Json | null
          row_hash?: string | null
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      data_class_privacy: {
        Row: {
          data_class: string
          mode: string
          updated_at: string
          user_id: string
        }
        Insert: {
          data_class: string
          mode: string
          updated_at?: string
          user_id: string
        }
        Update: {
          data_class?: string
          mode?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      devices: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["device_kind"]
          last_active_at: string
          name: string
          physical_pc_id: string | null
          revoked_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["device_kind"]
          last_active_at?: string
          name: string
          physical_pc_id?: string | null
          revoked_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["device_kind"]
          last_active_at?: string
          name?: string
          physical_pc_id?: string | null
          revoked_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          applicable_modules: string[]
          description: string | null
          enabled: boolean
          id: string
          stage: Database["public"]["Enums"]["feature_flag_stage"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          applicable_modules?: string[]
          description?: string | null
          enabled?: boolean
          id: string
          stage?: Database["public"]["Enums"]["feature_flag_stage"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          applicable_modules?: string[]
          description?: string | null
          enabled?: boolean
          id?: string
          stage?: Database["public"]["Enums"]["feature_flag_stage"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      launch_gate_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          evidence_url: string | null
          from_status: Database["public"]["Enums"]["launch_gate_status"] | null
          id: string
          item_id: string
          note: string | null
          to_status: Database["public"]["Enums"]["launch_gate_status"]
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          evidence_url?: string | null
          from_status?: Database["public"]["Enums"]["launch_gate_status"] | null
          id?: string
          item_id: string
          note?: string | null
          to_status: Database["public"]["Enums"]["launch_gate_status"]
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          evidence_url?: string | null
          from_status?: Database["public"]["Enums"]["launch_gate_status"] | null
          id?: string
          item_id?: string
          note?: string | null
          to_status?: Database["public"]["Enums"]["launch_gate_status"]
        }
        Relationships: [
          {
            foreignKeyName: "launch_gate_history_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "launch_gate_items"
            referencedColumns: ["id"]
          },
        ]
      }
      launch_gate_items: {
        Row: {
          applicable_modules: string[]
          blocker: boolean
          category: string
          created_at: string
          description: string | null
          due_date: string | null
          evidence_url: string | null
          id: string
          key: string
          notes: string | null
          owner: string | null
          reviewer: string | null
          status: Database["public"]["Enums"]["launch_gate_status"]
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          applicable_modules?: string[]
          blocker?: boolean
          category: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          evidence_url?: string | null
          id?: string
          key: string
          notes?: string | null
          owner?: string | null
          reviewer?: string | null
          status?: Database["public"]["Enums"]["launch_gate_status"]
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          applicable_modules?: string[]
          blocker?: boolean
          category?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          evidence_url?: string | null
          id?: string
          key?: string
          notes?: string | null
          owner?: string | null
          reviewer?: string | null
          status?: Database["public"]["Enums"]["launch_gate_status"]
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ocade_conversations: {
        Row: {
          archived: boolean
          created_at: string
          id: string
          model_id: string | null
          pinned: boolean
          privacy_mode: string
          provider_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id?: string
          model_id?: string | null
          pinned?: boolean
          privacy_mode?: string
          provider_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          id?: string
          model_id?: string | null
          pinned?: boolean
          privacy_mode?: string
          provider_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ocade_messages: {
        Row: {
          attachments: Json
          content: string
          conversation_id: string
          created_at: string
          id: string
          model_id: string | null
          provider_id: string | null
          role: string
          token_usage: Json | null
          user_id: string
        }
        Insert: {
          attachments?: Json
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          model_id?: string | null
          provider_id?: string | null
          role: string
          token_usage?: Json | null
          user_id: string
        }
        Update: {
          attachments?: Json
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          model_id?: string | null
          provider_id?: string | null
          role?: string
          token_usage?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocade_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ocade_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ocade_provider_events: {
        Row: {
          created_at: string
          detail: Json
          event_kind: string
          id: string
          latency_ms: number | null
          model: string | null
          ok: boolean | null
          provider: string
          user_id: string
        }
        Insert: {
          created_at?: string
          detail?: Json
          event_kind: string
          id?: string
          latency_ms?: number | null
          model?: string | null
          ok?: boolean | null
          provider: string
          user_id: string
        }
        Update: {
          created_at?: string
          detail?: Json
          event_kind?: string
          id?: string
          latency_ms?: number | null
          model?: string | null
          ok?: boolean | null
          provider?: string
          user_id?: string
        }
        Relationships: []
      }
      ocade_provider_prefs: {
        Row: {
          cost_pref: string
          ollama_bridge_url: string | null
          openai_direct_enabled: boolean
          privacy_pref: string
          routing: string
          session_override_model: string | null
          speed_pref: string
          updated_at: string
          user_id: string
          vision_required: boolean
        }
        Insert: {
          cost_pref?: string
          ollama_bridge_url?: string | null
          openai_direct_enabled?: boolean
          privacy_pref?: string
          routing?: string
          session_override_model?: string | null
          speed_pref?: string
          updated_at?: string
          user_id: string
          vision_required?: boolean
        }
        Update: {
          cost_pref?: string
          ollama_bridge_url?: string | null
          openai_direct_enabled?: boolean
          privacy_pref?: string
          routing?: string
          session_override_model?: string | null
          speed_pref?: string
          updated_at?: string
          user_id?: string
          vision_required?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string
          currency: string
          display_name: string | null
          id: string
          locale: string
          onboarding_completed: boolean
          onboarding_step: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          display_name?: string | null
          id: string
          locale?: string
          onboarding_completed?: boolean
          onboarding_step?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          display_name?: string | null
          id?: string
          locale?: string
          onboarding_completed?: boolean
          onboarding_step?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenant_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          accounting_method: string | null
          country: string | null
          created_at: string
          created_by: string
          currency: string
          fiscal_year_start_month: number
          id: string
          industry: string | null
          kind: Database["public"]["Enums"]["tenant_kind"]
          legal_name: string | null
          logo_url: string | null
          name: string
          region: string | null
          slug: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          accounting_method?: string | null
          country?: string | null
          created_at?: string
          created_by: string
          currency?: string
          fiscal_year_start_month?: number
          id?: string
          industry?: string | null
          kind?: Database["public"]["Enums"]["tenant_kind"]
          legal_name?: string | null
          logo_url?: string | null
          name: string
          region?: string | null
          slug?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          accounting_method?: string | null
          country?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          fiscal_year_start_month?: number
          id?: string
          industry?: string | null
          kind?: Database["public"]["Enums"]["tenant_kind"]
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          region?: string | null
          slug?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_private_records: {
        Row: {
          created_at: string
          data_class: string
          id: string
          updated_at: string
          user_id: string
          value: Json
        }
        Insert: {
          created_at?: string
          data_class: string
          id: string
          updated_at?: string
          user_id: string
          value: Json
        }
        Update: {
          created_at?: string
          data_class?: string
          id?: string
          updated_at?: string
          user_id?: string
          value?: Json
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          appearance_cursor: string
          appearance_cursor_custom: string | null
          appearance_cursor_size: number
          appearance_cursor_trail: boolean
          appearance_low_performance: boolean
          created_at: string
          family_planning_enabled: boolean
          high_contrast: boolean
          main_purpose: Database["public"]["Enums"]["main_purpose_kind"] | null
          modules: Json
          privacy_chats: Database["public"]["Enums"]["privacy_mode"]
          privacy_company: Database["public"]["Enums"]["privacy_mode"]
          privacy_copilot: Database["public"]["Enums"]["privacy_mode"]
          privacy_files: Database["public"]["Enums"]["privacy_mode"]
          privacy_images: Database["public"]["Enums"]["privacy_mode"]
          privacy_recordings: Database["public"]["Enums"]["privacy_mode"]
          privacy_resumes: Database["public"]["Enums"]["privacy_mode"]
          privacy_timesheets: Database["public"]["Enums"]["privacy_mode"]
          reduced_motion: boolean
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          appearance_cursor?: string
          appearance_cursor_custom?: string | null
          appearance_cursor_size?: number
          appearance_cursor_trail?: boolean
          appearance_low_performance?: boolean
          created_at?: string
          family_planning_enabled?: boolean
          high_contrast?: boolean
          main_purpose?: Database["public"]["Enums"]["main_purpose_kind"] | null
          modules?: Json
          privacy_chats?: Database["public"]["Enums"]["privacy_mode"]
          privacy_company?: Database["public"]["Enums"]["privacy_mode"]
          privacy_copilot?: Database["public"]["Enums"]["privacy_mode"]
          privacy_files?: Database["public"]["Enums"]["privacy_mode"]
          privacy_images?: Database["public"]["Enums"]["privacy_mode"]
          privacy_recordings?: Database["public"]["Enums"]["privacy_mode"]
          privacy_resumes?: Database["public"]["Enums"]["privacy_mode"]
          privacy_timesheets?: Database["public"]["Enums"]["privacy_mode"]
          reduced_motion?: boolean
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          appearance_cursor?: string
          appearance_cursor_custom?: string | null
          appearance_cursor_size?: number
          appearance_cursor_trail?: boolean
          appearance_low_performance?: boolean
          created_at?: string
          family_planning_enabled?: boolean
          high_contrast?: boolean
          main_purpose?: Database["public"]["Enums"]["main_purpose_kind"] | null
          modules?: Json
          privacy_chats?: Database["public"]["Enums"]["privacy_mode"]
          privacy_company?: Database["public"]["Enums"]["privacy_mode"]
          privacy_copilot?: Database["public"]["Enums"]["privacy_mode"]
          privacy_files?: Database["public"]["Enums"]["privacy_mode"]
          privacy_images?: Database["public"]["Enums"]["privacy_mode"]
          privacy_recordings?: Database["public"]["Enums"]["privacy_mode"]
          privacy_resumes?: Database["public"]["Enums"]["privacy_mode"]
          privacy_timesheets?: Database["public"]["Enums"]["privacy_mode"]
          reduced_motion?: boolean
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vault_config: {
        Row: {
          created_at: string
          credential_kind: string
          kdf_algo: string
          kdf_iterations: number
          kdf_salt: string
          last_rotated_at: string | null
          last_unlocked_at: string | null
          lock_timeout_seconds: number
          recovery_salt: string | null
          recovery_verifier: string | null
          recovery_wrapped_dek: string | null
          recovery_wrapped_dek_iv: string | null
          updated_at: string
          user_id: string
          webauthn_credential_id: string | null
          webauthn_prf_salt: string | null
          wrapped_dek: string
          wrapped_dek_iv: string
        }
        Insert: {
          created_at?: string
          credential_kind: string
          kdf_algo?: string
          kdf_iterations?: number
          kdf_salt: string
          last_rotated_at?: string | null
          last_unlocked_at?: string | null
          lock_timeout_seconds?: number
          recovery_salt?: string | null
          recovery_verifier?: string | null
          recovery_wrapped_dek?: string | null
          recovery_wrapped_dek_iv?: string | null
          updated_at?: string
          user_id: string
          webauthn_credential_id?: string | null
          webauthn_prf_salt?: string | null
          wrapped_dek: string
          wrapped_dek_iv: string
        }
        Update: {
          created_at?: string
          credential_kind?: string
          kdf_algo?: string
          kdf_iterations?: number
          kdf_salt?: string
          last_rotated_at?: string | null
          last_unlocked_at?: string | null
          lock_timeout_seconds?: number
          recovery_salt?: string | null
          recovery_verifier?: string | null
          recovery_wrapped_dek?: string | null
          recovery_wrapped_dek_iv?: string | null
          updated_at?: string
          user_id?: string
          webauthn_credential_id?: string | null
          webauthn_prf_salt?: string | null
          wrapped_dek?: string
          wrapped_dek_iv?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_tenant_role: {
        Args: {
          _role: Database["public"]["Enums"]["tenant_role"]
          _tenant_id: string
          _user_id: string
        }
        Returns: boolean
      }
      is_tenant_member: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      compliance_category:
        | "finance"
        | "payment"
        | "filing"
        | "signature"
        | "approval"
        | "role_change"
        | "sensitive_export"
        | "deletion"
        | "other"
      device_kind: "mobile" | "desktop"
      feature_flag_stage: "demo" | "private_alpha" | "beta" | "ga"
      launch_gate_status:
        | "not_started"
        | "in_progress"
        | "pending_review"
        | "evidence_required"
        | "complete"
        | "waived"
      main_purpose_kind: "solo" | "small_business" | "enterprise"
      privacy_mode: "device_only" | "private_sync"
      tenant_kind: "individual" | "company"
      tenant_role:
        | "owner"
        | "manager"
        | "employee"
        | "accountant"
        | "auditor"
        | "consultant"
        | "advisor"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
      compliance_category: [
        "finance",
        "payment",
        "filing",
        "signature",
        "approval",
        "role_change",
        "sensitive_export",
        "deletion",
        "other",
      ],
      device_kind: ["mobile", "desktop"],
      feature_flag_stage: ["demo", "private_alpha", "beta", "ga"],
      launch_gate_status: [
        "not_started",
        "in_progress",
        "pending_review",
        "evidence_required",
        "complete",
        "waived",
      ],
      main_purpose_kind: ["solo", "small_business", "enterprise"],
      privacy_mode: ["device_only", "private_sync"],
      tenant_kind: ["individual", "company"],
      tenant_role: [
        "owner",
        "manager",
        "employee",
        "accountant",
        "auditor",
        "consultant",
        "advisor",
      ],
    },
  },
} as const
