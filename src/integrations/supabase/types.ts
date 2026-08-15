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
      ficia_projects: {
        Row: {
          billable_default: boolean
          billing_rate_cents: number | null
          client_name: string | null
          code: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          department_id: string | null
          id: string
          name: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          billable_default?: boolean
          billing_rate_cents?: number | null
          client_name?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          department_id?: string | null
          id?: string
          name: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          billable_default?: boolean
          billing_rate_cents?: number | null
          client_name?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          department_id?: string | null
          id?: string
          name?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ficia_projects_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "ficia_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ficia_projects_tenant_id_fkey"
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
      ficia_tasks: {
        Row: {
          billable_default: boolean
          created_at: string
          id: string
          name: string
          project_id: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          billable_default?: boolean
          created_at?: string
          id?: string
          name: string
          project_id: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          billable_default?: boolean
          created_at?: string
          id?: string
          name?: string
          project_id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ficia_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ficia_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ficia_tasks_tenant_id_fkey"
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
      ficia_time_activity_samples: {
        Row: {
          at: string
          created_at: string
          entry_id: string | null
          id: string
          idle_seconds: number
          state: Database["public"]["Enums"]["time_activity_state"]
          tenant_id: string
          user_id: string
          window_focus: boolean | null
        }
        Insert: {
          at?: string
          created_at?: string
          entry_id?: string | null
          id?: string
          idle_seconds?: number
          state: Database["public"]["Enums"]["time_activity_state"]
          tenant_id: string
          user_id: string
          window_focus?: boolean | null
        }
        Update: {
          at?: string
          created_at?: string
          entry_id?: string | null
          id?: string
          idle_seconds?: number
          state?: Database["public"]["Enums"]["time_activity_state"]
          tenant_id?: string
          user_id?: string
          window_focus?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ficia_time_activity_samples_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "ficia_time_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ficia_time_activity_samples_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ficia_time_consents: {
        Row: {
          accepted_at: string
          accepted_terms: string
          activity_monitoring: boolean
          auto_pause: boolean
          created_at: string
          id: string
          ip_at_accept: string | null
          revoked_at: string | null
          screen_recording_optin: boolean
          tenant_id: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          accepted_terms: string
          activity_monitoring?: boolean
          auto_pause?: boolean
          created_at?: string
          id?: string
          ip_at_accept?: string | null
          revoked_at?: string | null
          screen_recording_optin?: boolean
          tenant_id: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          accepted_terms?: string
          activity_monitoring?: boolean
          auto_pause?: boolean
          created_at?: string
          id?: string
          ip_at_accept?: string | null
          revoked_at?: string | null
          screen_recording_optin?: boolean
          tenant_id?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ficia_time_consents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ficia_time_entries: {
        Row: {
          ai_time_split: Json
          approved_at: string | null
          approved_by: string | null
          billable: boolean
          billing_rate_cents: number | null
          break_seconds: number
          breaks: Json
          correction_of: string | null
          created_at: string
          currency: string | null
          department_id: string | null
          description: string | null
          duration_seconds: number | null
          ended_at: string | null
          entry_date: string
          evidence: Json
          id: string
          idle_seconds: number
          locked_period_id: string | null
          project_id: string | null
          rejected_reason: string | null
          source: Database["public"]["Enums"]["time_entry_source"]
          started_at: string
          status: Database["public"]["Enums"]["time_entry_status"]
          task_id: string | null
          tenant_id: string
          updated_at: string
          user_id: string
          work_mode: Database["public"]["Enums"]["time_work_mode"] | null
        }
        Insert: {
          ai_time_split?: Json
          approved_at?: string | null
          approved_by?: string | null
          billable?: boolean
          billing_rate_cents?: number | null
          break_seconds?: number
          breaks?: Json
          correction_of?: string | null
          created_at?: string
          currency?: string | null
          department_id?: string | null
          description?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          entry_date: string
          evidence?: Json
          id?: string
          idle_seconds?: number
          locked_period_id?: string | null
          project_id?: string | null
          rejected_reason?: string | null
          source?: Database["public"]["Enums"]["time_entry_source"]
          started_at: string
          status?: Database["public"]["Enums"]["time_entry_status"]
          task_id?: string | null
          tenant_id: string
          updated_at?: string
          user_id: string
          work_mode?: Database["public"]["Enums"]["time_work_mode"] | null
        }
        Update: {
          ai_time_split?: Json
          approved_at?: string | null
          approved_by?: string | null
          billable?: boolean
          billing_rate_cents?: number | null
          break_seconds?: number
          breaks?: Json
          correction_of?: string | null
          created_at?: string
          currency?: string | null
          department_id?: string | null
          description?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          entry_date?: string
          evidence?: Json
          id?: string
          idle_seconds?: number
          locked_period_id?: string | null
          project_id?: string | null
          rejected_reason?: string | null
          source?: Database["public"]["Enums"]["time_entry_source"]
          started_at?: string
          status?: Database["public"]["Enums"]["time_entry_status"]
          task_id?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
          work_mode?: Database["public"]["Enums"]["time_work_mode"] | null
        }
        Relationships: [
          {
            foreignKeyName: "ficia_time_entries_correction_of_fkey"
            columns: ["correction_of"]
            isOneToOne: false
            referencedRelation: "ficia_time_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ficia_time_entries_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "ficia_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ficia_time_entries_locked_period_id_fkey"
            columns: ["locked_period_id"]
            isOneToOne: false
            referencedRelation: "ficia_time_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ficia_time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ficia_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ficia_time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "ficia_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ficia_time_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ficia_time_events: {
        Row: {
          at: string
          created_at: string
          entry_id: string | null
          id: string
          kind: Database["public"]["Enums"]["time_event_kind"]
          metadata: Json
          tenant_id: string
          user_id: string
        }
        Insert: {
          at?: string
          created_at?: string
          entry_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["time_event_kind"]
          metadata?: Json
          tenant_id: string
          user_id: string
        }
        Update: {
          at?: string
          created_at?: string
          entry_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["time_event_kind"]
          metadata?: Json
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ficia_time_events_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "ficia_time_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ficia_time_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ficia_time_periods: {
        Row: {
          created_at: string
          id: string
          label: string | null
          locked_at: string
          locked_by: string
          period_end: string
          period_start: string
          reason: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          locked_at?: string
          locked_by: string
          period_end: string
          period_start: string
          reason?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          locked_at?: string
          locked_by?: string
          period_end?: string
          period_start?: string
          reason?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ficia_time_periods_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ficia_time_policies: {
        Row: {
          allowed_work_modes: string[]
          auto_pause_enabled: boolean
          billable_default: boolean
          break_minutes_paid: number
          break_minutes_unpaid: number
          created_at: string
          daily_hours_target: number
          holidays: Json
          id: string
          idle_threshold_minutes: number
          overtime_rules: Json
          screen_recording_available: boolean
          shift_end: string
          shift_start: string
          tenant_id: string
          timezone: string
          updated_at: string
          updated_by: string | null
          weekly_hours_target: number
          weekly_offs: number[]
          workdays: number[]
        }
        Insert: {
          allowed_work_modes?: string[]
          auto_pause_enabled?: boolean
          billable_default?: boolean
          break_minutes_paid?: number
          break_minutes_unpaid?: number
          created_at?: string
          daily_hours_target?: number
          holidays?: Json
          id?: string
          idle_threshold_minutes?: number
          overtime_rules?: Json
          screen_recording_available?: boolean
          shift_end?: string
          shift_start?: string
          tenant_id: string
          timezone?: string
          updated_at?: string
          updated_by?: string | null
          weekly_hours_target?: number
          weekly_offs?: number[]
          workdays?: number[]
        }
        Update: {
          allowed_work_modes?: string[]
          auto_pause_enabled?: boolean
          billable_default?: boolean
          break_minutes_paid?: number
          break_minutes_unpaid?: number
          created_at?: string
          daily_hours_target?: number
          holidays?: Json
          id?: string
          idle_threshold_minutes?: number
          overtime_rules?: Json
          screen_recording_available?: boolean
          shift_end?: string
          shift_start?: string
          tenant_id?: string
          timezone?: string
          updated_at?: string
          updated_by?: string | null
          weekly_hours_target?: number
          weekly_offs?: number[]
          workdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "ficia_time_policies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
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
      ocade_conversations: {
        Row: {
          archived: boolean
          created_at: string
          id: string
          model_id: string | null
          pinned: boolean
          privacy_mode: string
          project_id: string | null
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
          project_id?: string | null
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
      ocade_outputs: {
        Row: {
          content: string | null
          content_sha256: string | null
          conversation_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          kind: string
          lineage_id: string
          mime: string | null
          parent_output_id: string | null
          project_id: string | null
          size_bytes: number
          title: string
          user_id: string
          version: number
        }
        Insert: {
          content?: string | null
          content_sha256?: string | null
          conversation_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          kind: string
          lineage_id?: string
          mime?: string | null
          parent_output_id?: string | null
          project_id?: string | null
          size_bytes?: number
          title: string
          user_id: string
          version?: number
        }
        Update: {
          content?: string | null
          content_sha256?: string | null
          conversation_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          kind?: string
          lineage_id?: string
          mime?: string | null
          parent_output_id?: string | null
          project_id?: string | null
          size_bytes?: number
          title?: string
          user_id?: string
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
      profiles: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string
          currency: string
          custom_instructions: string | null
          display_name: string | null
          full_name: string | null
          id: string
          locale: string
          occupation: string | null
          onboarding_completed: boolean
          onboarding_step: string | null
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
          full_name?: string | null
          id: string
          locale?: string
          occupation?: string | null
          onboarding_completed?: boolean
          onboarding_step?: string | null
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
          full_name?: string | null
          id?: string
          locale?: string
          occupation?: string | null
          onboarding_completed?: boolean
          onboarding_step?: string | null
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
      create_company_with_owner: {
        Args: { _payload: Json; _uid: string }
        Returns: string
      }
      ficia_can_manage_worker: {
        Args: { _caller_uid: string; _tenant_id: string; _worker_uid: string }
        Returns: boolean
      }
      ficia_has_permission: {
        Args: { _perm: string; _tenant: string; _uid: string }
        Returns: boolean
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
      is_tenant_owner_or_manager: {
        Args: { _tenant: string; _uid: string }
        Returns: boolean
      }
      msg_is_thread_admin: {
        Args: { _thread_id: string; _user_id: string }
        Returns: boolean
      }
      msg_is_thread_member: {
        Args: { _thread_id: string; _user_id: string }
        Returns: boolean
      }
      msg_thread_writable: {
        Args: { _thread_id: string; _user_id: string }
        Returns: boolean
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
      time_activity_state:
        | "active"
        | "idle"
        | "minimized"
        | "closed"
        | "disconnected"
      time_entry_source: "clock" | "manual" | "import"
      time_entry_status:
        | "draft"
        | "submitted"
        | "approved"
        | "rejected"
        | "locked"
      time_event_kind:
        | "clock_in"
        | "clock_out"
        | "break_start"
        | "break_end"
        | "auto_pause"
        | "resume"
        | "manual_edit"
      time_work_mode: "office" | "remote" | "hybrid" | "field"
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
      time_activity_state: [
        "active",
        "idle",
        "minimized",
        "closed",
        "disconnected",
      ],
      time_entry_source: ["clock", "manual", "import"],
      time_entry_status: [
        "draft",
        "submitted",
        "approved",
        "rejected",
        "locked",
      ],
      time_event_kind: [
        "clock_in",
        "clock_out",
        "break_start",
        "break_end",
        "auto_pause",
        "resume",
        "manual_edit",
      ],
      time_work_mode: ["office", "remote", "hybrid", "field"],
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
