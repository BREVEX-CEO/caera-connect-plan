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
      access_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          message: string | null
          requested_role: Database["public"]["Enums"]["tenant_role"]
          requester_user_id: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          message?: string | null
          requested_role?: Database["public"]["Enums"]["tenant_role"]
          requester_user_id: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          message?: string | null
          requested_role?: Database["public"]["Enums"]["tenant_role"]
          requester_user_id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
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
      cania_alert_prefs: {
        Row: {
          channel: string
          created_at: string
          criteria: Json
          enabled: boolean
          id: string
          label: string
          section: string
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          criteria?: Json
          enabled?: boolean
          id?: string
          label: string
          section: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          criteria?: Json
          enabled?: boolean
          id?: string
          label?: string
          section?: string
          user_id?: string
        }
        Relationships: []
      }
      cania_saved_topics: {
        Row: {
          created_at: string
          id: string
          label: string
          query: string | null
          section: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          query?: string | null
          section: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          query?: string | null
          section?: string
          user_id?: string
        }
        Relationships: []
      }
      cania_settings: {
        Row: {
          approx_lat: number | null
          approx_lon: number | null
          country_code: string | null
          location_permission: string
          primary_currency: string | null
          region: string | null
          secondary_currency: string | null
          timezone: string | null
          units: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approx_lat?: number | null
          approx_lon?: number | null
          country_code?: string | null
          location_permission?: string
          primary_currency?: string | null
          region?: string | null
          secondary_currency?: string | null
          timezone?: string | null
          units?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approx_lat?: number | null
          approx_lon?: number | null
          country_code?: string | null
          location_permission?: string
          primary_currency?: string | null
          region?: string | null
          secondary_currency?: string | null
          timezone?: string | null
          units?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      company_obligations: {
        Row: {
          assignee_user_id: string | null
          category: string
          computed_at: string
          created_at: string
          due_date: string | null
          event_key: string
          evidence_url: string | null
          id: string
          notes: string | null
          period_label: string | null
          status: string
          tenant_id: string
          title: string
          updated_at: string
          version_id: string
        }
        Insert: {
          assignee_user_id?: string | null
          category: string
          computed_at?: string
          created_at?: string
          due_date?: string | null
          event_key: string
          evidence_url?: string | null
          id?: string
          notes?: string | null
          period_label?: string | null
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
          version_id: string
        }
        Update: {
          assignee_user_id?: string | null
          category?: string
          computed_at?: string
          created_at?: string
          due_date?: string | null
          event_key?: string
          evidence_url?: string | null
          id?: string
          notes?: string | null
          period_label?: string | null
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_obligations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_obligations_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "country_pack_versions"
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
      compliance_events: {
        Row: {
          applicability: Json
          cadence: string
          category: string
          created_at: string
          description: string | null
          due_rule: Json
          event_key: string
          form_ref: string | null
          id: string
          penalty_notes: string | null
          title: string
          version_id: string
        }
        Insert: {
          applicability?: Json
          cadence: string
          category: string
          created_at?: string
          description?: string | null
          due_rule?: Json
          event_key: string
          form_ref?: string | null
          id?: string
          penalty_notes?: string | null
          title: string
          version_id: string
        }
        Update: {
          applicability?: Json
          cadence?: string
          category?: string
          created_at?: string
          description?: string | null
          due_rule?: Json
          event_key?: string
          form_ref?: string | null
          id?: string
          penalty_notes?: string | null
          title?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_events_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "country_pack_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      country_pack_versions: {
        Row: {
          applicability: Json
          authored_by: string | null
          business_types: string[]
          changelog: string | null
          created_at: string
          effective_from: string
          effective_to: string | null
          ga_ready: boolean
          id: string
          jurisdiction: string
          pack_id: string
          pilot_evidence_url: string | null
          review_required_count: number
          rules: Json
          status: string
          updated_at: string
          version: string
        }
        Insert: {
          applicability?: Json
          authored_by?: string | null
          business_types?: string[]
          changelog?: string | null
          created_at?: string
          effective_from: string
          effective_to?: string | null
          ga_ready?: boolean
          id?: string
          jurisdiction?: string
          pack_id: string
          pilot_evidence_url?: string | null
          review_required_count?: number
          rules?: Json
          status?: string
          updated_at?: string
          version: string
        }
        Update: {
          applicability?: Json
          authored_by?: string | null
          business_types?: string[]
          changelog?: string | null
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          ga_ready?: boolean
          id?: string
          jurisdiction?: string
          pack_id?: string
          pilot_evidence_url?: string | null
          review_required_count?: number
          rules?: Json
          status?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "country_pack_versions_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "country_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      country_packs: {
        Row: {
          country_code: string
          created_at: string
          description: string | null
          id: string
          jurisdiction_level: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          country_code: string
          created_at?: string
          description?: string | null
          id?: string
          jurisdiction_level?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          country_code?: string
          created_at?: string
          description?: string | null
          id?: string
          jurisdiction_level?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
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
          platform: string | null
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
          platform?: string | null
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
          platform?: string | null
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
      ficia_approval_decisions: {
        Row: {
          approver_user_id: string
          decided_at: string
          decision: Database["public"]["Enums"]["approval_decision"]
          id: string
          reason: string | null
          request_id: string
          step: number
          tenant_id: string
        }
        Insert: {
          approver_user_id: string
          decided_at?: string
          decision: Database["public"]["Enums"]["approval_decision"]
          id?: string
          reason?: string | null
          request_id: string
          step: number
          tenant_id: string
        }
        Update: {
          approver_user_id?: string
          decided_at?: string
          decision?: Database["public"]["Enums"]["approval_decision"]
          id?: string
          reason?: string | null
          request_id?: string
          step?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ficia_approval_decisions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "ficia_approval_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ficia_approval_decisions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ficia_approval_policies: {
        Row: {
          created_at: string
          currency: string | null
          id: string
          is_active: boolean
          max_amount: number | null
          min_amount: number | null
          sod_enforced: boolean
          steps: Json
          subject: Database["public"]["Enums"]["approval_subject"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string | null
          id?: string
          is_active?: boolean
          max_amount?: number | null
          min_amount?: number | null
          sod_enforced?: boolean
          steps?: Json
          subject: Database["public"]["Enums"]["approval_subject"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string | null
          id?: string
          is_active?: boolean
          max_amount?: number | null
          min_amount?: number | null
          sod_enforced?: boolean
          steps?: Json
          subject?: Database["public"]["Enums"]["approval_subject"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ficia_approval_policies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ficia_approval_requests: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          current_step: number
          id: string
          payload: Json
          policy_id: string | null
          released_at: string | null
          released_by: string | null
          sod_override_at: string | null
          sod_override_by: string | null
          sod_override_reason: string | null
          status: Database["public"]["Enums"]["approval_status"]
          steps: Json
          subject: Database["public"]["Enums"]["approval_subject"]
          submitted_by: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          current_step?: number
          id?: string
          payload?: Json
          policy_id?: string | null
          released_at?: string | null
          released_by?: string | null
          sod_override_at?: string | null
          sod_override_by?: string | null
          sod_override_reason?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          steps?: Json
          subject: Database["public"]["Enums"]["approval_subject"]
          submitted_by: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          current_step?: number
          id?: string
          payload?: Json
          policy_id?: string | null
          released_at?: string | null
          released_by?: string | null
          sod_override_at?: string | null
          sod_override_by?: string | null
          sod_override_reason?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          steps?: Json
          subject?: Database["public"]["Enums"]["approval_subject"]
          submitted_by?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ficia_approval_requests_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "ficia_approval_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ficia_approval_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ficia_custom_roles: {
        Row: {
          base_role: Database["public"]["Enums"]["tenant_role"] | null
          created_at: string
          description: string | null
          id: string
          is_template: boolean
          key: string
          name: string
          permissions: Json
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          base_role?: Database["public"]["Enums"]["tenant_role"] | null
          created_at?: string
          description?: string | null
          id?: string
          is_template?: boolean
          key: string
          name: string
          permissions?: Json
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          base_role?: Database["public"]["Enums"]["tenant_role"] | null
          created_at?: string
          description?: string | null
          id?: string
          is_template?: boolean
          key?: string
          name?: string
          permissions?: Json
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ficia_custom_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ficia_departments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          manager_user_id: string | null
          name: string
          parent_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          manager_user_id?: string | null
          name: string
          parent_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          manager_user_id?: string | null
          name?: string
          parent_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ficia_departments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "ficia_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ficia_departments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ficia_employments: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string | null
          end_date: string | null
          id: string
          invited_email: string | null
          location_id: string | null
          manager_user_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["employment_status"]
          suspended_reason: string | null
          team_id: string | null
          tenant_id: string
          terminated_reason: string | null
          title: string | null
          updated_at: string
          user_id: string | null
          worker_type: Database["public"]["Enums"]["worker_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          end_date?: string | null
          id?: string
          invited_email?: string | null
          location_id?: string | null
          manager_user_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["employment_status"]
          suspended_reason?: string | null
          team_id?: string | null
          tenant_id: string
          terminated_reason?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
          worker_type?: Database["public"]["Enums"]["worker_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          end_date?: string | null
          id?: string
          invited_email?: string | null
          location_id?: string | null
          manager_user_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["employment_status"]
          suspended_reason?: string | null
          team_id?: string | null
          tenant_id?: string
          terminated_reason?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
          worker_type?: Database["public"]["Enums"]["worker_type"]
        }
        Relationships: [
          {
            foreignKeyName: "ficia_employments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "ficia_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ficia_employments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "ficia_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ficia_employments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "ficia_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ficia_employments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ficia_locations: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          id: string
          is_headquarters: boolean
          label: string
          region: string | null
          tenant_id: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_headquarters?: boolean
          label: string
          region?: string | null
          tenant_id: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_headquarters?: boolean
          label?: string
          region?: string | null
          tenant_id?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ficia_locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ficia_role_grants: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          revoked_at: string | null
          revoked_by: string | null
          role_key: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          role_key: string
          tenant_id: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          role_key?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ficia_role_grants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ficia_teams: {
        Row: {
          created_at: string
          department_id: string | null
          description: string | null
          id: string
          manager_user_id: string | null
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          manager_user_id?: string | null
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          manager_user_id?: string | null
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ficia_teams_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "ficia_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ficia_teams_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      historical_test_cases: {
        Row: {
          calculator: string
          case_key: string
          created_at: string
          description: string | null
          expected: Json
          id: string
          inputs: Json
          last_result: Json | null
          last_run_at: string | null
          last_status: string | null
          tolerance: number
          version_id: string
        }
        Insert: {
          calculator: string
          case_key: string
          created_at?: string
          description?: string | null
          expected: Json
          id?: string
          inputs: Json
          last_result?: Json | null
          last_run_at?: string | null
          last_status?: string | null
          tolerance?: number
          version_id: string
        }
        Update: {
          calculator?: string
          case_key?: string
          created_at?: string
          description?: string | null
          expected?: Json
          id?: string
          inputs?: Json
          last_result?: Json | null
          last_run_at?: string | null
          last_status?: string | null
          tolerance?: number
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "historical_test_cases_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "country_pack_versions"
            referencedColumns: ["id"]
          },
        ]
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
      legal_consent_receipts: {
        Row: {
          accepted_at: string
          created_at: string
          id: string
          privacy_version: string
          source: string
          terms_version: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          created_at?: string
          id?: string
          privacy_version: string
          source?: string
          terms_version: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          created_at?: string
          id?: string
          privacy_version?: string
          source?: string
          terms_version?: string
          user_id?: string
        }
        Relationships: []
      }
      madee_resume_projects: {
        Row: {
          archived: boolean
          attestation_accepted_at: string | null
          attestation_full_name: string | null
          attestation_text: string | null
          created_at: string
          current_version_id: string | null
          experience_level: string | null
          id: string
          profession: string | null
          storage_mode: string
          target_role: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          attestation_accepted_at?: string | null
          attestation_full_name?: string | null
          attestation_text?: string | null
          created_at?: string
          current_version_id?: string | null
          experience_level?: string | null
          id?: string
          profession?: string | null
          storage_mode?: string
          target_role?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          attestation_accepted_at?: string | null
          attestation_full_name?: string | null
          attestation_text?: string | null
          created_at?: string
          current_version_id?: string | null
          experience_level?: string | null
          id?: string
          profession?: string | null
          storage_mode?: string
          target_role?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "madee_projects_current_version_fk"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "madee_resume_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      madee_resume_versions: {
        Row: {
          ai_notes: Json
          content: Json
          content_stored_locally: boolean
          created_at: string
          id: string
          label: string | null
          project_id: string
          user_id: string
          version_number: number
        }
        Insert: {
          ai_notes?: Json
          content?: Json
          content_stored_locally?: boolean
          created_at?: string
          id?: string
          label?: string | null
          project_id: string
          user_id: string
          version_number: number
        }
        Update: {
          ai_notes?: Json
          content?: Json
          content_stored_locally?: boolean
          created_at?: string
          id?: string
          label?: string | null
          project_id?: string
          user_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "madee_resume_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "madee_resume_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      msg_attachments: {
        Row: {
          created_at: string
          duration_seconds: number | null
          file_name: string
          id: string
          is_voice_note: boolean
          message_id: string
          mime: string
          sha256: string | null
          size_bytes: number
          storage_path: string
          thread_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          file_name: string
          id?: string
          is_voice_note?: boolean
          message_id: string
          mime: string
          sha256?: string | null
          size_bytes: number
          storage_path: string
          thread_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          file_name?: string
          id?: string
          is_voice_note?: boolean
          message_id?: string
          mime?: string
          sha256?: string | null
          size_bytes?: number
          storage_path?: string
          thread_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "msg_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "msg_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "msg_attachments_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "msg_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      msg_cross_company_grants: {
        Row: {
          approved_by_from: string | null
          approved_by_to: string | null
          created_at: string
          from_tenant_id: string
          id: string
          reason: string | null
          requested_by: string
          status: Database["public"]["Enums"]["msg_grant_status"]
          thread_id: string
          to_tenant_id: string
          updated_at: string
        }
        Insert: {
          approved_by_from?: string | null
          approved_by_to?: string | null
          created_at?: string
          from_tenant_id: string
          id?: string
          reason?: string | null
          requested_by: string
          status?: Database["public"]["Enums"]["msg_grant_status"]
          thread_id: string
          to_tenant_id: string
          updated_at?: string
        }
        Update: {
          approved_by_from?: string | null
          approved_by_to?: string | null
          created_at?: string
          from_tenant_id?: string
          id?: string
          reason?: string | null
          requested_by?: string
          status?: Database["public"]["Enums"]["msg_grant_status"]
          thread_id?: string
          to_tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "msg_cross_company_grants_from_tenant_id_fkey"
            columns: ["from_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "msg_cross_company_grants_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "msg_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "msg_cross_company_grants_to_tenant_id_fkey"
            columns: ["to_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      msg_message_edits: {
        Row: {
          edited_at: string
          edited_by: string
          id: string
          message_id: string
          previous_body: string | null
        }
        Insert: {
          edited_at?: string
          edited_by: string
          id?: string
          message_id: string
          previous_body?: string | null
        }
        Update: {
          edited_at?: string
          edited_by?: string
          id?: string
          message_id?: string
          previous_body?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "msg_message_edits_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "msg_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      msg_message_links: {
        Row: {
          created_at: string
          created_by: string
          id: string
          link_kind: Database["public"]["Enums"]["msg_link_kind"]
          message_id: string
          note: string | null
          target_id: string | null
          target_ref: string | null
          thread_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          link_kind: Database["public"]["Enums"]["msg_link_kind"]
          message_id: string
          note?: string | null
          target_id?: string | null
          target_ref?: string | null
          thread_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          link_kind?: Database["public"]["Enums"]["msg_link_kind"]
          message_id?: string
          note?: string | null
          target_id?: string | null
          target_ref?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "msg_message_links_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "msg_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "msg_message_links_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "msg_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      msg_messages: {
        Row: {
          author_id: string
          body: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          edit_count: number
          edited_at: string | null
          id: string
          is_deleted: boolean
          kind: Database["public"]["Enums"]["msg_message_kind"]
          mentions_users: string[]
          reply_to: string | null
          scope_badge: Database["public"]["Enums"]["msg_scope_badge"]
          tenant_id: string | null
          thread_id: string
        }
        Insert: {
          author_id: string
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edit_count?: number
          edited_at?: string | null
          id?: string
          is_deleted?: boolean
          kind?: Database["public"]["Enums"]["msg_message_kind"]
          mentions_users?: string[]
          reply_to?: string | null
          scope_badge?: Database["public"]["Enums"]["msg_scope_badge"]
          tenant_id?: string | null
          thread_id: string
        }
        Update: {
          author_id?: string
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edit_count?: number
          edited_at?: string | null
          id?: string
          is_deleted?: boolean
          kind?: Database["public"]["Enums"]["msg_message_kind"]
          mentions_users?: string[]
          reply_to?: string | null
          scope_badge?: Database["public"]["Enums"]["msg_scope_badge"]
          tenant_id?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "msg_messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "msg_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "msg_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "msg_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "msg_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      msg_pins: {
        Row: {
          message_id: string
          pinned_at: string
          pinned_by: string
          thread_id: string
        }
        Insert: {
          message_id: string
          pinned_at?: string
          pinned_by: string
          thread_id: string
        }
        Update: {
          message_id?: string
          pinned_at?: string
          pinned_by?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "msg_pins_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "msg_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "msg_pins_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "msg_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      msg_reactions: {
        Row: {
          created_at: string
          emoji: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "msg_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "msg_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      msg_read_receipts: {
        Row: {
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "msg_read_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "msg_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      msg_thread_members: {
        Row: {
          joined_at: string
          last_read_at: string | null
          muted: boolean
          role: Database["public"]["Enums"]["msg_member_role"]
          thread_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          last_read_at?: string | null
          muted?: boolean
          role?: Database["public"]["Enums"]["msg_member_role"]
          thread_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          last_read_at?: string | null
          muted?: boolean
          role?: Database["public"]["Enums"]["msg_member_role"]
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "msg_thread_members_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "msg_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      msg_threads: {
        Row: {
          created_at: string
          created_by: string
          department_id: string | null
          dm_user_a: string | null
          dm_user_b: string | null
          id: string
          is_archived: boolean
          kind: Database["public"]["Enums"]["msg_thread_kind"]
          last_message_at: string | null
          name: string | null
          retention_days: number
          role_key: string | null
          scope_badge: Database["public"]["Enums"]["msg_scope_badge"]
          team_id: string | null
          tenant_id: string | null
          topic: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          department_id?: string | null
          dm_user_a?: string | null
          dm_user_b?: string | null
          id?: string
          is_archived?: boolean
          kind: Database["public"]["Enums"]["msg_thread_kind"]
          last_message_at?: string | null
          name?: string | null
          retention_days?: number
          role_key?: string | null
          scope_badge?: Database["public"]["Enums"]["msg_scope_badge"]
          team_id?: string | null
          tenant_id?: string | null
          topic?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          department_id?: string | null
          dm_user_a?: string | null
          dm_user_b?: string | null
          id?: string
          is_archived?: boolean
          kind?: Database["public"]["Enums"]["msg_thread_kind"]
          last_message_at?: string | null
          name?: string | null
          retention_days?: number
          role_key?: string | null
          scope_badge?: Database["public"]["Enums"]["msg_scope_badge"]
          team_id?: string | null
          tenant_id?: string | null
          topic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "msg_threads_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "ficia_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "msg_threads_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "ficia_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "msg_threads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ocade_approvals: {
        Row: {
          decided_at: string | null
          decided_by_device: string | null
          expires_at: string
          id: string
          requested_at: string
          risk: string
          status: string
          summary: string
          user_id: string
        }
        Insert: {
          decided_at?: string | null
          decided_by_device?: string | null
          expires_at: string
          id?: string
          requested_at?: string
          risk: string
          status?: string
          summary: string
          user_id: string
        }
        Update: {
          decided_at?: string | null
          decided_by_device?: string | null
          expires_at?: string
          id?: string
          requested_at?: string
          risk?: string
          status?: string
          summary?: string
          user_id?: string
        }
        Relationships: []
      }
      ocade_automation_runs: {
        Row: {
          approval_decision: string | null
          approval_expires_at: string | null
          approved_at: string | null
          approved_by_device: string | null
          attempt: number
          automation_id: string
          blocked_reason: string | null
          cancel_requested_at: string | null
          cancelled_at: string | null
          claim_token: string | null
          claimed_at: string | null
          created_at: string
          deadline_at: string | null
          dry_run: boolean
          error: string | null
          execution_steps: Json
          finished_at: string | null
          heartbeat_at: string | null
          highest_risk: string | null
          id: string
          lease_expires_at: string | null
          next_attempt_at: string | null
          next_step_index: number
          pause_requested_at: string | null
          plan: Json
          started_at: string | null
          status: string
          user_id: string
          worker_id: string | null
        }
        Insert: {
          approval_decision?: string | null
          approval_expires_at?: string | null
          approved_at?: string | null
          approved_by_device?: string | null
          attempt?: number
          automation_id: string
          blocked_reason?: string | null
          cancel_requested_at?: string | null
          cancelled_at?: string | null
          claim_token?: string | null
          claimed_at?: string | null
          created_at?: string
          deadline_at?: string | null
          dry_run?: boolean
          error?: string | null
          execution_steps?: Json
          finished_at?: string | null
          heartbeat_at?: string | null
          highest_risk?: string | null
          id?: string
          lease_expires_at?: string | null
          next_attempt_at?: string | null
          next_step_index?: number
          pause_requested_at?: string | null
          plan?: Json
          started_at?: string | null
          status?: string
          user_id: string
          worker_id?: string | null
        }
        Update: {
          approval_decision?: string | null
          approval_expires_at?: string | null
          approved_at?: string | null
          approved_by_device?: string | null
          attempt?: number
          automation_id?: string
          blocked_reason?: string | null
          cancel_requested_at?: string | null
          cancelled_at?: string | null
          claim_token?: string | null
          claimed_at?: string | null
          created_at?: string
          deadline_at?: string | null
          dry_run?: boolean
          error?: string | null
          execution_steps?: Json
          finished_at?: string | null
          heartbeat_at?: string | null
          highest_risk?: string | null
          id?: string
          lease_expires_at?: string | null
          next_attempt_at?: string | null
          next_step_index?: number
          pause_requested_at?: string | null
          plan?: Json
          started_at?: string | null
          status?: string
          user_id?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ocade_automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "ocade_automations"
            referencedColumns: ["id"]
          },
        ]
      }
      ocade_automation_step_receipts: {
        Row: {
          action_kind: string
          attempt: number
          created_at: string
          detail: string
          execution_ok: boolean
          finished_at: string
          id: string
          operation_id: string
          phase: string
          run_id: string
          started_at: string
          status: string
          step_index: number
          user_id: string
          verified: boolean
        }
        Insert: {
          action_kind: string
          attempt: number
          created_at?: string
          detail: string
          execution_ok: boolean
          finished_at: string
          id?: string
          operation_id: string
          phase: string
          run_id: string
          started_at: string
          status: string
          step_index: number
          user_id: string
          verified: boolean
        }
        Update: {
          action_kind?: string
          attempt?: number
          created_at?: string
          detail?: string
          execution_ok?: boolean
          finished_at?: string
          id?: string
          operation_id?: string
          phase?: string
          run_id?: string
          started_at?: string
          status?: string
          step_index?: number
          user_id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ocade_automation_step_receipts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "ocade_automation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      ocade_automations: {
        Row: {
          actions: Json
          created_at: string
          dry_run: boolean
          enabled: boolean
          id: string
          last_run_at: string | null
          max_attempts: number
          name: string
          next_run_at: string | null
          paused: boolean
          requires_approval: boolean
          trigger: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          actions?: Json
          created_at?: string
          dry_run?: boolean
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          max_attempts?: number
          name: string
          next_run_at?: string | null
          paused?: boolean
          requires_approval?: boolean
          trigger?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          actions?: Json
          created_at?: string
          dry_run?: boolean
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          max_attempts?: number
          name?: string
          next_run_at?: string | null
          paused?: boolean
          requires_approval?: boolean
          trigger?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ocade_browser_site_policy: {
        Row: {
          allow_origins: string[]
          deny_origins: string[]
          fill_origins: string[]
          read_origins: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_origins?: string[]
          deny_origins?: string[]
          fill_origins?: string[]
          read_origins?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_origins?: string[]
          deny_origins?: string[]
          fill_origins?: string[]
          read_origins?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ocade_commercial_usage: {
        Row: {
          id: string
          updated_at: string
          used_hundredths: number
          user_id: string
          window_kind: string
          window_start: string
        }
        Insert: {
          id?: string
          updated_at?: string
          used_hundredths?: number
          user_id: string
          window_kind?: string
          window_start: string
        }
        Update: {
          id?: string
          updated_at?: string
          used_hundredths?: number
          user_id?: string
          window_kind?: string
          window_start?: string
        }
        Relationships: []
      }
      ocade_conversation_shares: {
        Row: {
          conversation_id: string
          created_at: string
          expires_at: string | null
          id: string
          message_count: number
          messages: Json
          owner_id: string
          revoked_at: string | null
          snapshot_at: string
          title: string
          token: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          message_count?: number
          messages?: Json
          owner_id: string
          revoked_at?: string | null
          snapshot_at?: string
          title: string
          token?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          message_count?: number
          messages?: Json
          owner_id?: string
          revoked_at?: string | null
          snapshot_at?: string
          title?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocade_conversation_shares_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ocade_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ocade_conversations: {
        Row: {
          archived: boolean
          created_at: string
          deleted_at: string | null
          id: string
          model_id: string | null
          pinned: boolean
          project_id: string | null
          provider_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          model_id?: string | null
          pinned?: boolean
          project_id?: string | null
          provider_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          model_id?: string | null
          pinned?: boolean
          project_id?: string | null
          provider_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocade_conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ocade_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ocade_device_usage_keys: {
        Row: {
          algorithm: string
          created_at: string
          device_id: string
          public_key_base64: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          algorithm?: string
          created_at?: string
          device_id: string
          public_key_base64: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          algorithm?: string
          created_at?: string
          device_id?: string
          public_key_base64?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocade_device_usage_keys_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: true
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      ocade_device_usage_leases: {
        Row: {
          allocated_hundredths: number
          consumed_hundredths: number
          device_id: string
          expires_at: string
          id: string
          issued_at: string
          key_id: string | null
          last_event_hash: string
          last_sequence: number
          lease_version: number
          not_before: string
          preissued: boolean
          sequence_end: number
          sequence_start: number
          server_signature: string | null
          session_reset_at: string
          session_window_start: string
          signed_payload: Json | null
          status: string
          tier: string
          updated_at: string
          user_id: string
          week_reset_at: string
          week_window_start: string
        }
        Insert: {
          allocated_hundredths: number
          consumed_hundredths?: number
          device_id: string
          expires_at: string
          id?: string
          issued_at?: string
          key_id?: string | null
          last_event_hash?: string
          last_sequence?: number
          lease_version?: number
          not_before: string
          preissued?: boolean
          sequence_end?: number
          sequence_start?: number
          server_signature?: string | null
          session_reset_at: string
          session_window_start: string
          signed_payload?: Json | null
          status: string
          tier: string
          updated_at?: string
          user_id: string
          week_reset_at: string
          week_window_start: string
        }
        Update: {
          allocated_hundredths?: number
          consumed_hundredths?: number
          device_id?: string
          expires_at?: string
          id?: string
          issued_at?: string
          key_id?: string | null
          last_event_hash?: string
          last_sequence?: number
          lease_version?: number
          not_before?: string
          preissued?: boolean
          sequence_end?: number
          sequence_start?: number
          server_signature?: string | null
          session_reset_at?: string
          session_window_start?: string
          signed_payload?: Json | null
          status?: string
          tier?: string
          updated_at?: string
          user_id?: string
          week_reset_at?: string
          week_window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocade_device_usage_leases_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      ocade_generation_permits: {
        Row: {
          charged_hundredths: number | null
          expires_at: string
          finalized_at: string | null
          generation_id: string
          id: string
          idempotency_key: string
          issued_at: string
          release_reason: string | null
          reserved_hundredths: number
          session_limit_hundredths: number
          session_reset_at: string
          session_window_start: string
          status: string
          surface: string
          tier: string
          transport_claimed_at: string | null
          updated_at: string
          user_id: string
          week_limit_hundredths: number | null
          week_reset_at: string
          week_window_start: string
        }
        Insert: {
          charged_hundredths?: number | null
          expires_at: string
          finalized_at?: string | null
          generation_id: string
          id?: string
          idempotency_key: string
          issued_at?: string
          release_reason?: string | null
          reserved_hundredths: number
          session_limit_hundredths: number
          session_reset_at: string
          session_window_start: string
          status?: string
          surface: string
          tier: string
          transport_claimed_at?: string | null
          updated_at?: string
          user_id: string
          week_limit_hundredths?: number | null
          week_reset_at: string
          week_window_start: string
        }
        Update: {
          charged_hundredths?: number | null
          expires_at?: string
          finalized_at?: string | null
          generation_id?: string
          id?: string
          idempotency_key?: string
          issued_at?: string
          release_reason?: string | null
          reserved_hundredths?: number
          session_limit_hundredths?: number
          session_reset_at?: string
          session_window_start?: string
          status?: string
          surface?: string
          tier?: string
          transport_claimed_at?: string | null
          updated_at?: string
          user_id?: string
          week_limit_hundredths?: number | null
          week_reset_at?: string
          week_window_start?: string
        }
        Relationships: []
      }
      ocade_invoices: {
        Row: {
          amount_minor: number
          catalogue_version: string
          created_at: string
          currency: string
          id: string
          invoice_number: string
          issued_at: string
          payment_event_id: string | null
          plan_id: string
          receipt_url: string | null
          status: string
          tax_minor: number
          user_id: string
        }
        Insert: {
          amount_minor: number
          catalogue_version?: string
          created_at?: string
          currency: string
          id?: string
          invoice_number: string
          issued_at: string
          payment_event_id?: string | null
          plan_id: string
          receipt_url?: string | null
          status: string
          tax_minor?: number
          user_id: string
        }
        Update: {
          amount_minor?: number
          catalogue_version?: string
          created_at?: string
          currency?: string
          id?: string
          invoice_number?: string
          issued_at?: string
          payment_event_id?: string | null
          plan_id?: string
          receipt_url?: string | null
          status?: string
          tax_minor?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocade_invoices_payment_event_id_fkey"
            columns: ["payment_event_id"]
            isOneToOne: false
            referencedRelation: "ocade_payment_events"
            referencedColumns: ["id"]
          },
        ]
      }
      ocade_memory: {
        Row: {
          content: string
          created_at: string
          expires_at: string | null
          id: string
          pinned: boolean
          project_id: string | null
          scope: string
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          expires_at?: string | null
          id?: string
          pinned?: boolean
          project_id?: string | null
          scope?: string
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          pinned?: boolean
          project_id?: string | null
          scope?: string
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocade_memory_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ocade_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ocade_messages: {
        Row: {
          anchor_message_id: string | null
          attachments: Json
          citations: Json | null
          client_key: string | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          model_id: string | null
          provider_id: string | null
          reaction: string | null
          role: string
          token_usage: Json | null
          user_id: string
        }
        Insert: {
          anchor_message_id?: string | null
          attachments?: Json
          citations?: Json | null
          client_key?: string | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          model_id?: string | null
          provider_id?: string | null
          reaction?: string | null
          role: string
          token_usage?: Json | null
          user_id: string
        }
        Update: {
          anchor_message_id?: string | null
          attachments?: Json
          citations?: Json | null
          client_key?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          model_id?: string | null
          provider_id?: string | null
          reaction?: string | null
          role?: string
          token_usage?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocade_messages_anchor_message_id_fkey"
            columns: ["anchor_message_id"]
            isOneToOne: false
            referencedRelation: "ocade_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocade_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ocade_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ocade_mfa_recovery_attempts: {
        Row: {
          failed_count: number
          locked_until: string | null
          user_id: string
          window_started_at: string
        }
        Insert: {
          failed_count?: number
          locked_until?: string | null
          user_id: string
          window_started_at?: string
        }
        Update: {
          failed_count?: number
          locked_until?: string | null
          user_id?: string
          window_started_at?: string
        }
        Relationships: []
      }
      ocade_mfa_recovery_codes: {
        Row: {
          code_hash: string
          created_at: string
          generation: number
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          generation?: number
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          generation?: number
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ocade_monitors: {
        Row: {
          created_at: string
          id: string
          interval_ms: number
          last_checked_at: string | null
          sources: string[]
          state: string
          subject: string
          topic: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          interval_ms: number
          last_checked_at?: string | null
          sources: string[]
          state?: string
          subject: string
          topic: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          interval_ms?: number
          last_checked_at?: string | null
          sources?: string[]
          state?: string
          subject?: string
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      ocade_notification_preferences: {
        Row: {
          categories: Json
          mute_optional: boolean
          quiet_hours: Json
          revision: number
          updated_at: string
          user_id: string
        }
        Insert: {
          categories?: Json
          mute_optional?: boolean
          quiet_hours?: Json
          revision?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          categories?: Json
          mute_optional?: boolean
          quiet_hours?: Json
          revision?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ocade_notifications: {
        Row: {
          body: string
          category: string
          created_at: string
          deep_link: string | null
          delivery: Json
          id: string
          idempotency_key: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          category: string
          created_at?: string
          deep_link?: string | null
          delivery?: Json
          id?: string
          idempotency_key: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          deep_link?: string | null
          delivery?: Json
          id?: string
          idempotency_key?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      ocade_offline_usage_allocations: {
        Row: {
          amount_hundredths: number
          created_at: string
          device_id: string
          id: string
          lease_id: string
          request_key: string
          user_id: string
        }
        Insert: {
          amount_hundredths: number
          created_at?: string
          device_id: string
          id?: string
          lease_id: string
          request_key: string
          user_id: string
        }
        Update: {
          amount_hundredths?: number
          created_at?: string
          device_id?: string
          id?: string
          lease_id?: string
          request_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocade_offline_usage_allocations_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocade_offline_usage_allocations_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "ocade_device_usage_leases"
            referencedColumns: ["id"]
          },
        ]
      }
      ocade_offline_usage_events: {
        Row: {
          cost_hundredths: number
          device_id: string
          device_signature: string
          event_hash: string
          generation_id: string
          id: string
          idempotency_key: string
          lease_id: string
          occurred_at: string
          previous_hash: string
          reconciled_at: string
          sequence: number
          status: string
          surface: string
          user_id: string
        }
        Insert: {
          cost_hundredths: number
          device_id: string
          device_signature: string
          event_hash: string
          generation_id: string
          id: string
          idempotency_key: string
          lease_id: string
          occurred_at: string
          previous_hash: string
          reconciled_at?: string
          sequence: number
          status: string
          surface: string
          user_id: string
        }
        Update: {
          cost_hundredths?: number
          device_id?: string
          device_signature?: string
          event_hash?: string
          generation_id?: string
          id?: string
          idempotency_key?: string
          lease_id?: string
          occurred_at?: string
          previous_hash?: string
          reconciled_at?: string
          sequence?: number
          status?: string
          surface?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocade_offline_usage_events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocade_offline_usage_events_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "ocade_device_usage_leases"
            referencedColumns: ["id"]
          },
        ]
      }
      ocade_organization_events: {
        Row: {
          actor_id: string | null
          created_at: string
          detail: Json
          event: string
          id: string
          organization_id: string
          subject_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          detail?: Json
          event: string
          id?: string
          organization_id: string
          subject_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          detail?: Json
          event?: string
          id?: string
          organization_id?: string
          subject_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ocade_organization_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "ocade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ocade_organization_group_members: {
        Row: {
          added_at: string
          group_id: string
          member_id: string
        }
        Insert: {
          added_at?: string
          group_id: string
          member_id: string
        }
        Update: {
          added_at?: string
          group_id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocade_organization_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "ocade_organization_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocade_organization_group_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "ocade_organization_members"
            referencedColumns: ["id"]
          },
        ]
      }
      ocade_organization_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocade_organization_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "ocade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ocade_organization_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          revoked_at: string | null
          revoked_by: string | null
          role: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by: string
          organization_id: string
          revoked_at?: string | null
          revoked_by?: string | null
          role?: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          role?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocade_organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "ocade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ocade_organization_members: {
        Row: {
          id: string
          invited_by: string | null
          joined_at: string
          organization_id: string
          role: string
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          invited_by?: string | null
          joined_at?: string
          organization_id: string
          role?: string
          state?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          invited_by?: string | null
          joined_at?: string
          organization_id?: string
          role?: string
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocade_organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "ocade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ocade_organization_policies: {
        Row: {
          organization_id: string
          updated_at: string
          updated_by: string | null
          withheld_capabilities: string[]
          withheld_tool_domains: string[]
        }
        Insert: {
          organization_id: string
          updated_at?: string
          updated_by?: string | null
          withheld_capabilities?: string[]
          withheld_tool_domains?: string[]
        }
        Update: {
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
          withheld_capabilities?: string[]
          withheld_tool_domains?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "ocade_organization_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "ocade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ocade_organizations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      ocade_outputs: {
        Row: {
          content: string | null
          content_sha256: string | null
          context: Json | null
          conversation_id: string | null
          created_at: string
          evidence: string | null
          expires_at: string | null
          id: string
          kind: string
          lineage_id: string
          mime: string | null
          parent_output_id: string | null
          produced_by: string | null
          project_id: string | null
          size_bytes: number
          title: string
          user_id: string
          verified: boolean
          version: number
        }
        Insert: {
          content?: string | null
          content_sha256?: string | null
          context?: Json | null
          conversation_id?: string | null
          created_at?: string
          evidence?: string | null
          expires_at?: string | null
          id?: string
          kind: string
          lineage_id?: string
          mime?: string | null
          parent_output_id?: string | null
          produced_by?: string | null
          project_id?: string | null
          size_bytes?: number
          title: string
          user_id: string
          verified?: boolean
          version?: number
        }
        Update: {
          content?: string | null
          content_sha256?: string | null
          context?: Json | null
          conversation_id?: string | null
          created_at?: string
          evidence?: string | null
          expires_at?: string | null
          id?: string
          kind?: string
          lineage_id?: string
          mime?: string | null
          parent_output_id?: string | null
          produced_by?: string | null
          project_id?: string | null
          size_bytes?: number
          title?: string
          user_id?: string
          verified?: boolean
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ocade_outputs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ocade_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocade_outputs_parent_output_id_fkey"
            columns: ["parent_output_id"]
            isOneToOne: false
            referencedRelation: "ocade_outputs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocade_outputs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ocade_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ocade_payment_events: {
        Row: {
          amount_minor: number
          catalogue_version: string
          created_at: string
          currency: string
          id: string
          kind: string
          occurred_at: string
          plan_id: string
          provider: string
          provider_event_id: string
          provider_payment_ref: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount_minor: number
          catalogue_version?: string
          created_at?: string
          currency: string
          id?: string
          kind: string
          occurred_at: string
          plan_id: string
          provider: string
          provider_event_id: string
          provider_payment_ref?: string | null
          status: string
          user_id: string
        }
        Update: {
          amount_minor?: number
          catalogue_version?: string
          created_at?: string
          currency?: string
          id?: string
          kind?: string
          occurred_at?: string
          plan_id?: string
          provider?: string
          provider_event_id?: string
          provider_payment_ref?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      ocade_project_files: {
        Row: {
          content_sha256: string
          created_at: string
          folder: string
          id: string
          mime: string
          name: string
          project_id: string
          size_bytes: number
          text: string
          user_id: string
        }
        Insert: {
          content_sha256: string
          created_at?: string
          folder?: string
          id?: string
          mime?: string
          name: string
          project_id: string
          size_bytes: number
          text: string
          user_id: string
        }
        Update: {
          content_sha256?: string
          created_at?: string
          folder?: string
          id?: string
          mime?: string
          name?: string
          project_id?: string
          size_bytes?: number
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocade_project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ocade_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ocade_project_folders: {
        Row: {
          created_at: string
          id: string
          path: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          path: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          path?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocade_project_folders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ocade_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ocade_project_items: {
        Row: {
          created_at: string
          id: string
          kind: string
          project_id: string
          ref_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          project_id: string
          ref_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          project_id?: string
          ref_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocade_project_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ocade_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ocade_projects: {
        Row: {
          archived: boolean
          created_at: string
          id: string
          instructions: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id?: string
          instructions?: string | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          id?: string
          instructions?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      ocade_status_incident_updates: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          incident_id: string
          state: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          incident_id: string
          state: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          incident_id?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocade_status_incident_updates_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "ocade_status_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      ocade_status_incidents: {
        Row: {
          component_ids: string[]
          created_at: string
          created_by: string | null
          id: string
          impact: string
          kind: string
          resolved_at: string | null
          scheduled_end: string | null
          started_at: string
          state: string
          title: string
          updated_at: string
        }
        Insert: {
          component_ids?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          impact: string
          kind: string
          resolved_at?: string | null
          scheduled_end?: string | null
          started_at?: string
          state?: string
          title: string
          updated_at?: string
        }
        Update: {
          component_ids?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          impact?: string
          kind?: string
          resolved_at?: string | null
          scheduled_end?: string | null
          started_at?: string
          state?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ocade_subscriptions: {
        Row: {
          catalogue_version: string
          created_at: string
          expires_at: string
          id: string
          plan_id: string
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          catalogue_version?: string
          created_at?: string
          expires_at: string
          id?: string
          plan_id: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          catalogue_version?: string
          created_at?: string
          expires_at?: string
          id?: string
          plan_id?: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ocade_support_article_revisions: {
        Row: {
          body: string[]
          category: string
          created_at: string
          created_by: string | null
          id: string
          keywords: string[]
          note: string
          slug: string
          status: string
          summary: string
          title: string
        }
        Insert: {
          body: string[]
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          keywords?: string[]
          note?: string
          slug: string
          status: string
          summary: string
          title: string
        }
        Update: {
          body?: string[]
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          keywords?: string[]
          note?: string
          slug?: string
          status?: string
          summary?: string
          title?: string
        }
        Relationships: []
      }
      ocade_support_articles: {
        Row: {
          body: string[]
          category: string
          keywords: string[]
          slug: string
          status: string
          summary: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body: string[]
          category: string
          keywords?: string[]
          slug: string
          status: string
          summary: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string[]
          category?: string
          keywords?: string[]
          slug?: string
          status?: string
          summary?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ocade_support_messages: {
        Row: {
          author_id: string
          author_role: string
          body: string
          created_at: string
          id: string
          ticket_id: string
        }
        Insert: {
          author_id: string
          author_role: string
          body: string
          created_at?: string
          id?: string
          ticket_id: string
        }
        Update: {
          author_id?: string
          author_role?: string
          body?: string
          created_at?: string
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocade_support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ocade_support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ocade_support_tickets: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string
          id: string
          last_message_at: string
          priority: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          category: string
          created_at?: string
          id?: string
          last_message_at?: string
          priority?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          id?: string
          last_message_at?: string
          priority?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ocade_task_comments: {
        Row: {
          archived_at: string | null
          body: string
          created_at: string
          id: string
          parent_id: string | null
          reacted: boolean
          resolved_at: string | null
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          body: string
          created_at?: string
          id?: string
          parent_id?: string | null
          reacted?: boolean
          resolved_at?: string | null
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          body?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          reacted?: boolean
          resolved_at?: string | null
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocade_task_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "ocade_task_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocade_task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "ocade_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      ocade_tasks: {
        Row: {
          agent: string | null
          created_at: string
          current_step: string | null
          dependency_task_ids: string[]
          device_id: string | null
          finished_at: string | null
          id: string
          input_refs: string[]
          last_error: string | null
          output_refs: string[]
          permission_requirements: string[]
          progress: number | null
          project_id: string | null
          receipts: string[]
          request: string | null
          retry_count: number
          scheduled_for: string | null
          source: string
          source_ref: string | null
          started_at: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agent?: string | null
          created_at?: string
          current_step?: string | null
          dependency_task_ids?: string[]
          device_id?: string | null
          finished_at?: string | null
          id?: string
          input_refs?: string[]
          last_error?: string | null
          output_refs?: string[]
          permission_requirements?: string[]
          progress?: number | null
          project_id?: string | null
          receipts?: string[]
          request?: string | null
          retry_count?: number
          scheduled_for?: string | null
          source: string
          source_ref?: string | null
          started_at?: string | null
          status: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agent?: string | null
          created_at?: string
          current_step?: string | null
          dependency_task_ids?: string[]
          device_id?: string | null
          finished_at?: string | null
          id?: string
          input_refs?: string[]
          last_error?: string | null
          output_refs?: string[]
          permission_requirements?: string[]
          progress?: number | null
          project_id?: string | null
          receipts?: string[]
          request?: string | null
          retry_count?: number
          scheduled_for?: string | null
          source?: string
          source_ref?: string | null
          started_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocade_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ocade_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_reviews: {
        Row: {
          created_at: string
          credential_id: string | null
          decision: string
          evidence_url: string | null
          id: string
          notes: string | null
          reviewer_credential: string
          reviewer_name: string
          reviewer_user_id: string | null
          scope: string | null
          signed_at: string
          version_id: string
        }
        Insert: {
          created_at?: string
          credential_id?: string | null
          decision: string
          evidence_url?: string | null
          id?: string
          notes?: string | null
          reviewer_credential: string
          reviewer_name: string
          reviewer_user_id?: string | null
          scope?: string | null
          signed_at?: string
          version_id: string
        }
        Update: {
          created_at?: string
          credential_id?: string | null
          decision?: string
          evidence_url?: string | null
          id?: string
          notes?: string | null
          reviewer_credential?: string
          reviewer_name?: string
          reviewer_user_id?: string | null
          scope?: string | null
          signed_at?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pack_reviews_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "country_pack_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_events: {
        Row: {
          entity_id: string | null
          environment: string
          event_id: string
          event_type: string
          occurred_at: string
          outcome: string
          reason: string | null
          received_at: string
          user_id: string | null
        }
        Insert: {
          entity_id?: string | null
          environment: string
          event_id: string
          event_type: string
          occurred_at: string
          outcome: string
          reason?: string | null
          received_at?: string
          user_id?: string | null
        }
        Update: {
          entity_id?: string | null
          environment?: string
          event_id?: string
          event_type?: string
          occurred_at?: string
          outcome?: string
          reason?: string | null
          received_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string
          currency: string
          custom_instructions: string | null
          display_name: string | null
          email: string | null
          full_name: string | null
          id: string
          locale: string
          occupation: string | null
          onboarding_completed: boolean
          onboarding_step: string | null
          phone: string | null
          preferred_name: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          custom_instructions?: string | null
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          locale?: string
          occupation?: string | null
          onboarding_completed?: boolean
          onboarding_step?: string | null
          phone?: string | null
          preferred_name?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          custom_instructions?: string | null
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          locale?: string
          occupation?: string | null
          onboarding_completed?: boolean
          onboarding_step?: string | null
          phone?: string | null
          preferred_name?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      rule_sources: {
        Row: {
          citation: string
          created_at: string
          document_ref: string | null
          id: string
          notes: string | null
          retrieved_at: string
          rule_key: string
          source_type: string
          url: string | null
          version_id: string
        }
        Insert: {
          citation: string
          created_at?: string
          document_ref?: string | null
          id?: string
          notes?: string | null
          retrieved_at?: string
          rule_key: string
          source_type: string
          url?: string | null
          version_id: string
        }
        Update: {
          citation?: string
          created_at?: string
          document_ref?: string | null
          id?: string
          notes?: string | null
          retrieved_at?: string
          rule_key?: string
          source_type?: string
          url?: string | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rule_sources_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "country_pack_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_tombstones: {
        Row: {
          attempts: number
          bucket: string
          id: string
          last_error: string | null
          owner_id: string | null
          purged_at: string | null
          requested_at: string
          source: string
          storage_path: string
        }
        Insert: {
          attempts?: number
          bucket: string
          id?: string
          last_error?: string | null
          owner_id?: string | null
          purged_at?: string | null
          requested_at?: string
          source?: string
          storage_path: string
        }
        Update: {
          attempts?: number
          bucket?: string
          id?: string
          last_error?: string | null
          owner_id?: string | null
          purged_at?: string | null
          requested_at?: string
          source?: string
          storage_path?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          kind: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          provider_event_at: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          kind?: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          provider_event_at?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          kind?: string
          paddle_customer_id?: string
          paddle_subscription_id?: string
          price_id?: string
          product_id?: string
          provider_event_at?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
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
          address: Json
          branches: Json
          contact: Json
          country: string | null
          created_at: string
          created_by: string
          currency: string
          description: string | null
          entity_type: string | null
          fiscal_year_end_month: number | null
          fiscal_year_start_month: number
          id: string
          industry: string | null
          kind: Database["public"]["Enums"]["tenant_kind"]
          legal_name: string | null
          logo_url: string | null
          name: string
          region: string | null
          registration_number: string | null
          slug: string | null
          status: string
          subsidiaries: Json
          tax_ids: Json
          timezone: string
          updated_at: string
        }
        Insert: {
          accounting_method?: string | null
          address?: Json
          branches?: Json
          contact?: Json
          country?: string | null
          created_at?: string
          created_by: string
          currency?: string
          description?: string | null
          entity_type?: string | null
          fiscal_year_end_month?: number | null
          fiscal_year_start_month?: number
          id?: string
          industry?: string | null
          kind?: Database["public"]["Enums"]["tenant_kind"]
          legal_name?: string | null
          logo_url?: string | null
          name: string
          region?: string | null
          registration_number?: string | null
          slug?: string | null
          status?: string
          subsidiaries?: Json
          tax_ids?: Json
          timezone?: string
          updated_at?: string
        }
        Update: {
          accounting_method?: string | null
          address?: Json
          branches?: Json
          contact?: Json
          country?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          description?: string | null
          entity_type?: string | null
          fiscal_year_end_month?: number | null
          fiscal_year_start_month?: number
          id?: string
          industry?: string | null
          kind?: Database["public"]["Enums"]["tenant_kind"]
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          region?: string | null
          registration_number?: string | null
          slug?: string | null
          status?: string
          subsidiaries?: Json
          tax_ids?: Json
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
          appearance_depth_3d: boolean
          appearance_depth_strength: number
          appearance_low_performance: boolean
          created_at: string
          family_planning_enabled: boolean
          high_contrast: boolean
          main_purpose: Database["public"]["Enums"]["main_purpose_kind"] | null
          modules: Json
          ocade_memory_enabled: boolean
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
          appearance_depth_3d?: boolean
          appearance_depth_strength?: number
          appearance_low_performance?: boolean
          created_at?: string
          family_planning_enabled?: boolean
          high_contrast?: boolean
          main_purpose?: Database["public"]["Enums"]["main_purpose_kind"] | null
          modules?: Json
          ocade_memory_enabled?: boolean
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
          appearance_depth_3d?: boolean
          appearance_depth_strength?: number
          appearance_low_performance?: boolean
          created_at?: string
          family_planning_enabled?: boolean
          high_contrast?: boolean
          main_purpose?: Database["public"]["Enums"]["main_purpose_kind"] | null
          modules?: Json
          ocade_memory_enabled?: boolean
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
      apply_payment_webhook_event: {
        Args: {
          p_action: string
          p_allow_terminal_reversal: boolean
          p_cancel_at_period_end: boolean
          p_current_period_end: string
          p_current_period_start: string
          p_entity_id: string
          p_environment: string
          p_event_id: string
          p_event_type: string
          p_kind: string
          p_occurred_at: string
          p_paddle_customer_id: string
          p_paddle_subscription_id: string
          p_price_id: string
          p_product_id: string
          p_reason: string
          p_status: string
          p_user_id: string
        }
        Returns: string
      }
      attachment_deletion_status: {
        Args: never
        Returns: {
          oldest_pending: string
          pending: number
          purged: number
        }[]
      }
      create_company_with_owner: {
        Args: { _payload: Json; _uid: string }
        Returns: string
      }
      find_conflicting_legal_id: {
        Args: {
          _country: string
          _gstin: string
          _pan: string
          _registration: string
        }
        Returns: {
          id: string
          matched: string
          name: string
        }[]
      }
      find_similar_company_names: {
        Args: { _country: string; _name: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
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
      ocade_accept_organization_invite: {
        Args: { p_token_hash: string }
        Returns: string
      }
      ocade_acquire_generation_permit: {
        Args: {
          p_generation_id: string
          p_idempotency_key: string
          p_reserved_hundredths: number
          p_session_limit_hundredths: number
          p_surface: string
          p_tier: string
          p_user_id: string
          p_week_limit_hundredths: number
        }
        Returns: {
          outcome: string
          permit_id: string
          reserved_hundredths: number
          session_reset_at: string
          week_reset_at: string
        }[]
      }
      ocade_activate_offline_usage_lease: {
        Args: {
          p_key_id: string
          p_lease_id: string
          p_server_signature: string
          p_signed_payload: Json
          p_user_id: string
        }
        Returns: boolean
      }
      ocade_admin_notification_delivery: {
        Args: { p_since: string }
        Returns: {
          category: string
          channel: string
          occurrences: number
          state: string
        }[]
      }
      ocade_allocate_offline_usage: {
        Args: {
          p_amount_hundredths: number
          p_browser_install_id: string
          p_device_id: string
          p_device_public_key: string
          p_preissue?: boolean
          p_request_key: string
          p_session_limit_hundredths: number
          p_tier: string
          p_user_id: string
          p_week_limit_hundredths: number
        }
        Returns: {
          allocated_hundredths: number
          consumed_hundredths: number
          expires_at: string
          issued_at: string
          lease_id: string
          not_before: string
          outcome: string
          preissued: boolean
          sequence_end: number
          sequence_start: number
          session_reset_at: string
          session_window_start: string
          tier: string
          week_reset_at: string
          week_window_start: string
        }[]
      }
      ocade_append_automation_receipt: {
        Args: {
          p_action_kind: string
          p_claim_token: string
          p_detail: string
          p_execution_ok: boolean
          p_finished_at: string
          p_operation_id: string
          p_phase: string
          p_run_id: string
          p_started_at: string
          p_status: string
          p_step_index: number
          p_verified: boolean
        }
        Returns: boolean
      }
      ocade_cancel_all_automation_runs: { Args: never; Returns: Json }
      ocade_claim_automation_run: {
        Args: { p_run_id: string; p_worker_id: string }
        Returns: {
          approval_expires_at: string
          attempt: number
          claim_token: string
          confirmed: boolean
          deadline_at: string
          execution_steps: Json
          id: string
          max_attempts: number
          next_step_index: number
        }[]
      }
      ocade_claim_generation_transport: {
        Args: {
          p_generation_id: string
          p_idempotency_key: string
          p_permit_id: string
          p_surface: string
          p_user_id: string
        }
        Returns: boolean
      }
      ocade_complete_automation_run: {
        Args: {
          p_claim_token: string
          p_error: string
          p_finished_at: string
          p_run_id: string
          p_status: string
        }
        Returns: boolean
      }
      ocade_consume_commercial_work: {
        Args: {
          p_cost_hundredths: number
          p_limit_hundredths: number
          p_user_id: string
          p_window_kind: string
          p_window_start: string
        }
        Returns: number
      }
      ocade_consume_mfa_recovery_code: {
        Args: {
          p_code_hash: string
          p_lock_seconds?: number
          p_max_failures?: number
          p_user_id: string
          p_window_seconds?: number
        }
        Returns: string
      }
      ocade_conversation_trash_days: { Args: never; Returns: number }
      ocade_count_mfa_recovery_codes: {
        Args: { p_user_id: string }
        Returns: {
          generated_at: string
          remaining: number
          total: number
        }[]
      }
      ocade_create_organization: {
        Args: { p_name: string; p_slug: string }
        Returns: string
      }
      ocade_create_organization_group: {
        Args: { p_name: string; p_organization_id: string }
        Returns: string
      }
      ocade_create_support_ticket: {
        Args: { p_body: string; p_category: string; p_subject: string }
        Returns: string
      }
      ocade_decide_approval: {
        Args: { _device_id?: string; _id: string; _status: string }
        Returns: {
          decided_at: string | null
          decided_by_device: string | null
          expires_at: string
          id: string
          requested_at: string
          risk: string
          status: string
          summary: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "ocade_approvals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ocade_decide_automation_run: {
        Args: { p_decision: string; p_device_id?: string; p_run_id: string }
        Returns: string
      }
      ocade_delete_organization: {
        Args: { p_organization_id: string; p_typed_name: string }
        Returns: number
      }
      ocade_delete_organization_group: {
        Args: { p_group_id: string }
        Returns: number
      }
      ocade_enqueue_automation_run: {
        Args: {
          p_automation_id: string
          p_blocked_reason?: string
          p_deadline_at?: string
          p_dry_run: boolean
          p_execution_steps: Json
          p_highest_risk: string
          p_next_run_at?: string
          p_plan: Json
          p_status: string
        }
        Returns: {
          id: string
          reused: boolean
          status: string
        }[]
      }
      ocade_expire_automation_approval: {
        Args: {
          p_claim_token: string
          p_reason: string
          p_requested_at: string
          p_run_id: string
        }
        Returns: boolean
      }
      ocade_expire_commercial_permits: {
        Args: { p_now?: string; p_user_id: string }
        Returns: number
      }
      ocade_expire_due_approvals: {
        Args: never
        Returns: {
          decided_at: string | null
          decided_by_device: string | null
          expires_at: string
          id: string
          requested_at: string
          risk: string
          status: string
          summary: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "ocade_approvals"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      ocade_expire_offline_usage_leases: {
        Args: { p_now?: string; p_user_id: string }
        Returns: number
      }
      ocade_finalize_generation_permit: {
        Args: {
          p_cost_hundredths: number
          p_idempotency_key: string
          p_user_id: string
        }
        Returns: {
          charged_hundredths: number
          outcome: string
        }[]
      }
      ocade_heartbeat_automation_run: {
        Args: { p_claim_token: string; p_run_id: string }
        Returns: boolean
      }
      ocade_invite_to_organization: {
        Args: {
          p_email: string
          p_expires_at: string
          p_organization_id: string
          p_role: string
          p_token_hash: string
        }
        Returns: string
      }
      ocade_list_account_sessions: {
        Args: { p_user_id: string }
        Returns: {
          assurance: string
          created_at: string
          expires_at: string
          ip_address: string
          last_seen_at: string
          session_id: string
          user_agent: string
        }[]
      }
      ocade_mark_all_notifications_read: { Args: never; Returns: number }
      ocade_mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: number
      }
      ocade_my_organizations_blocking_deletion: {
        Args: never
        Returns: {
          name: string
          organization_id: string
          solo: boolean
        }[]
      }
      ocade_open_status_incident: {
        Args: {
          p_body: string
          p_component_ids: string[]
          p_impact: string
          p_kind: string
          p_scheduled_end?: string
          p_started_at?: string
          p_title: string
        }
        Returns: string
      }
      ocade_org_active_owners: {
        Args: { p_excluding: string; p_organization_id: string }
        Returns: number
      }
      ocade_org_can_administer: {
        Args: { p_organization_id: string }
        Returns: boolean
      }
      ocade_org_is_owner: {
        Args: { p_organization_id: string }
        Returns: boolean
      }
      ocade_org_role: { Args: { p_organization_id: string }; Returns: string }
      ocade_organizations_blocking_deletion: {
        Args: { p_user_id: string }
        Returns: {
          name: string
          organization_id: string
          solo: boolean
        }[]
      }
      ocade_post_status_incident_update: {
        Args: { p_body: string; p_incident_id: string; p_state: string }
        Returns: number
      }
      ocade_purge_expired_conversation_trash: { Args: never; Returns: number }
      ocade_read_commercial_usage: {
        Args: { p_user_id: string }
        Returns: {
          reserved_hundredths: number
          reset_at: string
          used_hundredths: number
          window_kind: string
          window_start: string
        }[]
      }
      ocade_read_offline_usage: {
        Args: { p_user_id: string }
        Returns: {
          allocated_hundredths: number
          consumed_hundredths: number
          device_id: string
          device_name: string
          device_public_key: string
          expires_at: string
          key_id: string
          last_event_hash: string
          last_sequence: number
          lease_id: string
          not_before: string
          pending_hundredths: number
          preissued: boolean
          server_signature: string
          session_reset_at: string
          session_window_start: string
          signed_payload: Json
          status: string
          tier: string
          week_reset_at: string
          week_window_start: string
        }[]
      }
      ocade_read_shared_conversation: {
        Args: { p_token: string }
        Returns: {
          message_count: number
          messages: Json
          snapshot_at: string
          title: string
        }[]
      }
      ocade_recent_proof_window: { Args: never; Returns: string }
      ocade_reconcile_offline_usage: {
        Args: {
          p_consumed_hundredths: number
          p_device_id: string
          p_events: Json
          p_last_event_hash: string
          p_last_sequence: number
          p_lease_id: string
          p_user_id: string
        }
        Returns: number
      }
      ocade_record_notification: {
        Args: {
          p_body: string
          p_category: string
          p_deep_link: string
          p_delivery?: Json
          p_idempotency_key: string
          p_title: string
          p_user_id: string
        }
        Returns: string
      }
      ocade_record_organization_event: {
        Args: {
          p_detail?: Json
          p_event: string
          p_organization_id: string
          p_subject_id?: string
        }
        Returns: undefined
      }
      ocade_recover_stale_automation_runs: {
        Args: { p_stale_before: string }
        Returns: Json
      }
      ocade_release_commercial_work: {
        Args: {
          p_cost_hundredths: number
          p_user_id: string
          p_window_kind: string
          p_window_start: string
        }
        Returns: number
      }
      ocade_release_generation_permit: {
        Args: { p_idempotency_key: string; p_reason: string; p_user_id: string }
        Returns: boolean
      }
      ocade_remove_organization_member: {
        Args: { p_member_id: string }
        Returns: number
      }
      ocade_rename_organization: {
        Args: { p_name: string; p_organization_id: string }
        Returns: number
      }
      ocade_replace_mfa_recovery_codes: {
        Args: { p_code_hashes: string[]; p_user_id: string }
        Returns: number
      }
      ocade_request_automation_cancel: {
        Args: { p_run_id: string }
        Returns: string
      }
      ocade_request_automation_pause: {
        Args: { p_run_id: string }
        Returns: string
      }
      ocade_requeue_automation_run: {
        Args: {
          p_attempt: number
          p_claim_token: string
          p_error: string
          p_next_attempt_at: string
          p_run_id: string
        }
        Returns: boolean
      }
      ocade_require_recent_strong_auth: {
        Args: { p_action: string }
        Returns: undefined
      }
      ocade_resend_organization_invite: {
        Args: {
          p_expires_at: string
          p_invite_id: string
          p_token_hash: string
        }
        Returns: number
      }
      ocade_resume_automation_run: {
        Args: { p_run_id: string }
        Returns: string
      }
      ocade_return_offline_usage: {
        Args: { p_device_id: string; p_lease_id: string; p_user_id: string }
        Returns: number
      }
      ocade_revoke_account_session: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: number
      }
      ocade_revoke_conversation_share: {
        Args: { p_conversation_id: string }
        Returns: number
      }
      ocade_revoke_organization_invite: {
        Args: { p_invite_id: string }
        Returns: number
      }
      ocade_revoke_other_account_sessions: {
        Args: { p_keep_session_id?: string; p_user_id: string }
        Returns: number
      }
      ocade_save_notification_preferences: {
        Args: {
          p_categories: Json
          p_mute_optional: boolean
          p_quiet_hours: Json
        }
        Returns: number
      }
      ocade_save_support_article: {
        Args: {
          p_body: string[]
          p_category: string
          p_keywords: string[]
          p_note?: string
          p_slug: string
          p_status: string
          p_summary: string
          p_title: string
        }
        Returns: number
      }
      ocade_session_has_verified_factor: { Args: never; Returns: boolean }
      ocade_session_is_live: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: boolean
      }
      ocade_session_last_proof_at: { Args: never; Returns: string }
      ocade_set_organization_group_membership: {
        Args: { p_group_id: string; p_member_id: string; p_present: boolean }
        Returns: number
      }
      ocade_set_organization_member_role: {
        Args: { p_member_id: string; p_role: string }
        Returns: number
      }
      ocade_set_organization_member_state: {
        Args: { p_member_id: string; p_state: string }
        Returns: number
      }
      ocade_set_organization_policy: {
        Args: {
          p_organization_id: string
          p_withheld_capabilities: string[]
          p_withheld_tool_domains: string[]
        }
        Returns: number
      }
      ocade_share_conversation: {
        Args: { p_conversation_id: string; p_expires_at?: string }
        Returns: string
      }
      ocade_suspend_automation_run: {
        Args: {
          p_claim_token: string
          p_paused_at: string
          p_reason: string
          p_run_id: string
        }
        Returns: boolean
      }
      ocade_transfer_organization_ownership: {
        Args: { p_organization_id: string; p_to_user_id: string }
        Returns: number
      }
      revoke_device_for_current_user: {
        Args: { _device_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      approval_decision: "approve" | "reject"
      approval_status:
        | "pending"
        | "approved"
        | "rejected"
        | "released"
        | "withdrawn"
      approval_subject:
        | "expense"
        | "invoice"
        | "payroll"
        | "tax"
        | "files"
        | "payments"
        | "signatures"
        | "export"
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
      employment_status: "invited" | "active" | "suspended" | "terminated"
      feature_flag_stage: "demo" | "private_alpha" | "beta" | "ga"
      launch_gate_status:
        | "not_started"
        | "in_progress"
        | "pending_review"
        | "evidence_required"
        | "complete"
        | "waived"
      main_purpose_kind: "solo" | "small_business" | "enterprise"
      msg_grant_status:
        | "pending_from"
        | "pending_to"
        | "active"
        | "revoked"
        | "rejected"
      msg_link_kind:
        | "task"
        | "approval"
        | "timesheet"
        | "evidence"
        | "invoice"
        | "expense"
        | "filing"
        | "signature"
      msg_member_role: "admin" | "member"
      msg_message_kind: "text" | "voice" | "system"
      msg_scope_badge: "company" | "private" | "cross_company" | "dm"
      msg_thread_kind:
        | "company"
        | "department"
        | "role"
        | "project"
        | "private"
        | "dm"
        | "cross_company"
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
      worker_type:
        | "employee"
        | "contractor"
        | "advisor"
        | "auditor"
        | "consultant"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      approval_decision: ["approve", "reject"],
      approval_status: [
        "pending",
        "approved",
        "rejected",
        "released",
        "withdrawn",
      ],
      approval_subject: [
        "expense",
        "invoice",
        "payroll",
        "tax",
        "files",
        "payments",
        "signatures",
        "export",
      ],
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
      employment_status: ["invited", "active", "suspended", "terminated"],
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
      msg_grant_status: [
        "pending_from",
        "pending_to",
        "active",
        "revoked",
        "rejected",
      ],
      msg_link_kind: [
        "task",
        "approval",
        "timesheet",
        "evidence",
        "invoice",
        "expense",
        "filing",
        "signature",
      ],
      msg_member_role: ["admin", "member"],
      msg_message_kind: ["text", "voice", "system"],
      msg_scope_badge: ["company", "private", "cross_company", "dm"],
      msg_thread_kind: [
        "company",
        "department",
        "role",
        "project",
        "private",
        "dm",
        "cross_company",
      ],
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
      worker_type: [
        "employee",
        "contractor",
        "advisor",
        "auditor",
        "consultant",
      ],
    },
  },
} as const
