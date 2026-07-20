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
      audit_log: {
        Row: {
          action: string
          created_at: string
          feature_id: string | null
          id: string
          ip: string | null
          preview: Json | null
          result: Json | null
          tenant_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          feature_id?: string | null
          id?: string
          ip?: string | null
          preview?: Json | null
          result?: Json | null
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          feature_id?: string | null
          id?: string
          ip?: string | null
          preview?: Json | null
          result?: Json | null
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
      devices: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["device_kind"]
          last_active_at: string
          name: string
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
          revoked_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          description: string | null
          enabled: boolean
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          enabled?: boolean
          id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          enabled?: boolean
          id?: string
          updated_at?: string
          updated_by?: string | null
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
          created_at: string
          family_planning_enabled: boolean
          high_contrast: boolean
          main_purpose: string | null
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
          created_at?: string
          family_planning_enabled?: boolean
          high_contrast?: boolean
          main_purpose?: string | null
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
          created_at?: string
          family_planning_enabled?: boolean
          high_contrast?: boolean
          main_purpose?: string | null
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
      device_kind: "mobile" | "desktop"
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
      device_kind: ["mobile", "desktop"],
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
