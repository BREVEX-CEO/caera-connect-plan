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
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          feature_id?: string | null
          id?: string
          metadata?: Json
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          feature_id?: string | null
          id?: string
          metadata?: Json
          user_id?: string
        }
        Relationships: []
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
          user_agent?: string | null
          user_id?: string | null
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
      jarvis_activity: {
        Row: {
          action: Json | null
          claimed_at: string | null
          completed_at: string | null
          confirmed: boolean
          confirmed_at: string | null
          controller: string | null
          created_at: string
          device_id: string | null
          id: string
          resolution: string | null
          resolved_at: string | null
          result: Json | null
          status: string
          summary: string
          task_id: string
          user_id: string
        }
        Insert: {
          action?: Json | null
          claimed_at?: string | null
          completed_at?: string | null
          confirmed?: boolean
          confirmed_at?: string | null
          controller?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          resolution?: string | null
          resolved_at?: string | null
          result?: Json | null
          status?: string
          summary: string
          task_id: string
          user_id: string
        }
        Update: {
          action?: Json | null
          claimed_at?: string | null
          completed_at?: string | null
          confirmed?: boolean
          confirmed_at?: string | null
          controller?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          resolution?: string | null
          resolved_at?: string | null
          result?: Json | null
          status?: string
          summary?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jarvis_activity_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "jarvis_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jarvis_activity_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "jarvis_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      jarvis_devices: {
        Row: {
          app_icons: Json
          background_enabled: boolean
          capabilities: Json
          created_at: string
          enrollment_expires_at: string | null
          enrollment_source: string | null
          id: string
          installed_apps: Json
          key_rotated_at: string | null
          kind: string
          last_request_ms: number
          last_seen_at: string | null
          name: string
          nudge_topic: string
          platform: string | null
          protocol_version: number
          public_key: string | null
          revoked_at: string | null
          software_version: string | null
          user_id: string | null
        }
        Insert: {
          app_icons?: Json
          background_enabled?: boolean
          capabilities?: Json
          created_at?: string
          enrollment_expires_at?: string | null
          enrollment_source?: string | null
          id?: string
          installed_apps?: Json
          key_rotated_at?: string | null
          kind?: string
          last_request_ms?: number
          last_seen_at?: string | null
          name?: string
          nudge_topic?: string
          platform?: string | null
          protocol_version?: number
          public_key?: string | null
          revoked_at?: string | null
          software_version?: string | null
          user_id?: string | null
        }
        Update: {
          app_icons?: Json
          background_enabled?: boolean
          capabilities?: Json
          created_at?: string
          enrollment_expires_at?: string | null
          enrollment_source?: string | null
          id?: string
          installed_apps?: Json
          key_rotated_at?: string | null
          kind?: string
          last_request_ms?: number
          last_seen_at?: string | null
          name?: string
          nudge_topic?: string
          platform?: string | null
          protocol_version?: number
          public_key?: string | null
          revoked_at?: string | null
          software_version?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      jarvis_memories: {
        Row: {
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      jarvis_permissions: {
        Row: {
          allowed: boolean
          capability: string
          device_id: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed: boolean
          capability: string
          device_id?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed?: boolean
          capability?: string
          device_id?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jarvis_permissions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "jarvis_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      jarvis_schedules: {
        Row: {
          active: boolean
          checks: Json | null
          claimed_at: string | null
          claimed_occurrence: string | null
          conversation_id: string
          created_at: string
          device_id: string | null
          id: string
          last_outcome: string | null
          last_run_at: string | null
          next_at: string
          repeat: string
          time_zone: string
          user_id: string
          what: string
        }
        Insert: {
          active?: boolean
          checks?: Json | null
          claimed_at?: string | null
          claimed_occurrence?: string | null
          conversation_id: string
          created_at?: string
          device_id?: string | null
          id?: string
          last_outcome?: string | null
          last_run_at?: string | null
          next_at: string
          repeat?: string
          time_zone?: string
          user_id: string
          what: string
        }
        Update: {
          active?: boolean
          checks?: Json | null
          claimed_at?: string | null
          claimed_occurrence?: string | null
          conversation_id?: string
          created_at?: string
          device_id?: string | null
          id?: string
          last_outcome?: string | null
          last_run_at?: string | null
          next_at?: string
          repeat?: string
          time_zone?: string
          user_id?: string
          what?: string
        }
        Relationships: []
      }
      jarvis_tasks: {
        Row: {
          blocker: string | null
          browser_mode: string
          checkpoint: Json | null
          controller: string | null
          conversation_id: string
          created_at: string
          current_step: number
          device_id: string | null
          finished_at: string | null
          id: string
          live_frame: string | null
          live_frame_at: string | null
          model_calls: number
          model_ms: number
          outcome: Json | null
          paused_at: string | null
          plan: Json
          result: string | null
          retry_at: string | null
          schedule_occurrence: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
          user_wait_ms: number
          verified_actions: number | null
        }
        Insert: {
          blocker?: string | null
          browser_mode?: string
          checkpoint?: Json | null
          controller?: string | null
          conversation_id: string
          created_at?: string
          current_step?: number
          device_id?: string | null
          finished_at?: string | null
          id?: string
          live_frame?: string | null
          live_frame_at?: string | null
          model_calls?: number
          model_ms?: number
          outcome?: Json | null
          paused_at?: string | null
          plan?: Json
          result?: string | null
          retry_at?: string | null
          schedule_occurrence?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
          user_wait_ms?: number
          verified_actions?: number | null
        }
        Update: {
          blocker?: string | null
          browser_mode?: string
          checkpoint?: Json | null
          controller?: string | null
          conversation_id?: string
          created_at?: string
          current_step?: number
          device_id?: string | null
          finished_at?: string | null
          id?: string
          live_frame?: string | null
          live_frame_at?: string | null
          model_calls?: number
          model_ms?: number
          outcome?: Json | null
          paused_at?: string | null
          plan?: Json
          result?: string | null
          retry_at?: string | null
          schedule_occurrence?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          user_wait_ms?: number
          verified_actions?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "jarvis_tasks_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ocade_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jarvis_tasks_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "jarvis_devices"
            referencedColumns: ["id"]
          },
        ]
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
      ocade_admin_actions: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          id: string
          reason: string
          subject: string | null
          target_user: string | null
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          id?: string
          reason: string
          subject?: string | null
          target_user?: string | null
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          id?: string
          reason?: string
          subject?: string | null
          target_user?: string | null
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
      ocade_conversations: {
        Row: {
          archived: boolean
          created_at: string
          id: string
          model_id: string | null
          pinned: boolean
          provider_id: string | null
          surface: string
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
          provider_id?: string | null
          surface?: string
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
          provider_id?: string | null
          surface?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      ocade_entitlement_grants: {
        Row: {
          created_at: string
          ends_at: string
          granted_by: string
          id: string
          reason: string
          revoked_at: string | null
          revoked_by: string | null
          revoked_reason: string | null
          starts_at: string
          tier: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          granted_by: string
          id?: string
          reason: string
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          starts_at?: string
          tier: string
          user_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          granted_by?: string
          id?: string
          reason?: string
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          starts_at?: string
          tier?: string
          user_id?: string
        }
        Relationships: []
      }
      ocade_jarvis_task_charges: {
        Row: {
          charged_at: string
          charged_hundredths: number
          task_id: string
          user_id: string
        }
        Insert: {
          charged_at?: string
          charged_hundredths: number
          task_id: string
          user_id: string
        }
        Update: {
          charged_at?: string
          charged_hundredths?: number
          task_id?: string
          user_id?: string
        }
        Relationships: []
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
          task_id: string | null
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
          task_id?: string | null
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
          task_id?: string | null
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
      ocade_library_items: {
        Row: {
          conversation_id: string | null
          created_at: string
          id: string
          kind: string
          mime: string
          name: string
          size_bytes: number
          source: string
          storage_path: string
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          kind: string
          mime: string
          name: string
          size_bytes: number
          source: string
          storage_path: string
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          mime?: string
          name?: string
          size_bytes?: number
          source?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocade_library_items_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ocade_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ocade_messages: {
        Row: {
          attachments: Json
          client_key: string | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          model_id: string | null
          provider_id: string | null
          role: string
          user_id: string
        }
        Insert: {
          attachments?: Json
          client_key?: string | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          model_id?: string | null
          provider_id?: string | null
          role: string
          user_id: string
        }
        Update: {
          attachments?: Json
          client_key?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          model_id?: string | null
          provider_id?: string | null
          role?: string
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
          recovered_at: string | null
          recovering_factors: string[] | null
          recovering_session: string | null
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          generation?: number
          id?: string
          recovered_at?: string | null
          recovering_factors?: string[] | null
          recovering_session?: string | null
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          generation?: number
          id?: string
          recovered_at?: string | null
          recovering_factors?: string[] | null
          recovering_session?: string | null
          used_at?: string | null
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
      ocade_push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          failures: number
          last_sent_at: string | null
          p256dh: string
          session_id: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          failures?: number
          last_sent_at?: string | null
          p256dh: string
          session_id: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          failures?: number
          last_sent_at?: string | null
          p256dh?: string
          session_id?: string
          user_id?: string
        }
        Relationships: []
      }
      ocade_service_control_events: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          key: string
          paused: boolean
          reason: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          key: string
          paused: boolean
          reason: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          key?: string
          paused?: boolean
          reason?: string
        }
        Relationships: []
      }
      ocade_service_controls: {
        Row: {
          changed_at: string
          changed_by: string | null
          key: string
          paused: boolean
          reason: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          key: string
          paused?: boolean
          reason?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          key?: string
          paused?: boolean
          reason?: string | null
        }
        Relationships: []
      }
      ocade_staff: {
        Row: {
          created_at: string
          denied: string[]
          granted: string[]
          granted_by: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          denied?: string[]
          granted?: string[]
          granted_by?: string | null
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          denied?: string[]
          granted?: string[]
          granted_by?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ocade_staff_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: string
          withdrawn_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          role: string
          withdrawn_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          withdrawn_at?: string | null
        }
        Relationships: []
      }
      ocade_support_shares: {
        Row: {
          conversation: string
          created_at: string
          customer: string
          expires_at: string
          id: string
          revoked_at: string | null
        }
        Insert: {
          conversation: string
          created_at?: string
          customer: string
          expires_at: string
          id?: string
          revoked_at?: string | null
        }
        Update: {
          conversation?: string
          created_at?: string
          customer?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
        }
        Relationships: []
      }
      ocade_support_cases: {
        Row: {
          assignee: string | null
          closed_at: string | null
          conversation: string | null
          customer: string
          expires_at: string
          id: string
          opened_at: string
          opened_by: string | null
          reason: string
        }
        Insert: {
          assignee?: string | null
          closed_at?: string | null
          conversation?: string | null
          customer: string
          expires_at: string
          id?: string
          opened_at?: string
          opened_by?: string | null
          reason: string
        }
        Update: {
          assignee?: string | null
          closed_at?: string | null
          conversation?: string | null
          customer?: string
          expires_at?: string
          id?: string
          opened_at?: string
          opened_by?: string | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocade_support_cases_conversation_fkey"
            columns: ["conversation"]
            isOneToOne: false
            referencedRelation: "ocade_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ocade_unlimited_grants: {
        Row: {
          created_at: string
          ends_at: string | null
          granted_by: string | null
          id: string
          reason: string
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          granted_by?: string | null
          id?: string
          reason: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          granted_by?: string | null
          id?: string
          reason?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ocade_usage_adjustments: {
        Row: {
          actor: string | null
          created_at: string
          delta_hundredths: number
          id: string
          reason: string
          surface: string
          used_after: number
          used_before: number
          user_id: string | null
          window_kind: string
          window_start: string
        }
        Insert: {
          actor?: string | null
          created_at?: string
          delta_hundredths: number
          id?: string
          reason: string
          surface: string
          used_after: number
          used_before: number
          user_id?: string | null
          window_kind: string
          window_start: string
        }
        Update: {
          actor?: string | null
          created_at?: string
          delta_hundredths?: number
          id?: string
          reason?: string
          surface?: string
          used_after?: number
          used_before?: number
          user_id?: string | null
          window_kind?: string
          window_start?: string
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
          online_ai_consent_at: string | null
          online_ai_consent_version: string | null
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
          online_ai_consent_at?: string | null
          online_ai_consent_version?: string | null
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
          online_ai_consent_at?: string | null
          online_ai_consent_version?: string | null
          onboarding_completed?: boolean
          onboarding_step?: string | null
          phone?: string | null
          preferred_name?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
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
      ocade_enforce_second_factor: { Args: never; Returns: undefined }
      ocade_session_meets_second_factor: { Args: never; Returns: boolean }
      jarvis_action_allowed: {
        Args: { p_action: Json; p_device: string; p_user: string }
        Returns: boolean
      }
      jarvis_grants: {
        Args: { p_device: string; p_user: string }
        Returns: Json
      }
      jarvis_task_wait: {
        Args: { p_controller: string; p_reason: string; p_task: string }
        Returns: undefined
      }
      jarvis_task_wait_until: {
        Args: { p_controller: string; p_reason: string; p_retry_at: string; p_task: string }
        Returns: undefined
      }
      jarvis_tell: {
        Args: { p_task: string; p_text: string }
        Returns: undefined
      }
      jarvis_confirm_action: {
        Args: { p_activity: string; p_user: string }
        Returns: boolean
      }
      jarvis_take_over: {
        Args: { p_task: string; p_user: string }
        Returns: string
      }
      jarvis_resume_task: {
        Args: { p_task: string; p_user: string }
        Returns: string
      }
      jarvis_device_inventory: {
        Args: { p_apps: Json; p_device: string; p_engines: Json; p_mcp: Json }
        Returns: undefined
      }
      jarvis_allowed: {
        Args: { p_capability: string; p_device: string; p_user: string }
        Returns: boolean
      }
      jarvis_approve_device: {
        Args: { p_code: string; p_user: string }
        Returns: string
      }
      jarvis_claim_action: {
        Args: { p_device: string }
        Returns: Json
      }
      jarvis_device_code: {
        Args: { p_public_key: string }
        Returns: string
      }
      jarvis_device_key: {
        Args: { p_device: string }
        Returns: string
      }
      jarvis_device_seen: {
        Args: { p_device: string; p_timestamp_ms: number }
        Returns: boolean
      }
      jarvis_device_topic: {
        Args: { p_device: string }
        Returns: string
      }
      jarvis_enroll_device: {
        Args: {
          p_name: string
          p_platform: string
          p_public_key: string
          p_software_version: string
          p_source: string
        }
        Returns: {
          code: string
          device_id: string
          expires_at: string
        }[]
      }
      jarvis_note_model: {
        Args: { p_ms: number; p_task: string }
        Returns: undefined
      }
      jarvis_online_consented: {
        Args: { p_user: string; p_version: string }
        Returns: boolean
      }
      jarvis_open_task: {
        Args: {
          p_conversation: string
          p_device: string
          p_outcome: Json
          p_plan: Json
          p_title: string
          p_user: string
        }
        Returns: {
          controller: string
          reused: boolean
          status: string
          task_id: string
        }[]
      }
      jarvis_paused: {
        Args: never
        Returns: boolean
      }
      jarvis_queue_actions: {
        Args: { p_actions: Json; p_controller: string; p_task: string }
        Returns: number
      }
      jarvis_resolve_effect: {
        Args: { p_activity: string; p_resolution: string; p_user: string }
        Returns: boolean
      }
      jarvis_resume_due: {
        Args: { p_device: string }
        Returns: string
      }
      jarvis_revoke_device: {
        Args: { p_device: string; p_user: string }
        Returns: boolean
      }
      jarvis_set_outcome: {
        Args: { p_controller: string; p_outcome: Json; p_plan: Json; p_task: string }
        Returns: undefined
      }
      jarvis_settle_task: {
        Args: { p_controller: string; p_summary: string; p_task: string; p_verification: Json }
        Returns: string
      }
      jarvis_stop_task: {
        Args: { p_task: string; p_user: string }
        Returns: {
          cancelled: number
          in_flight: number
          status: string
        }[]
      }
      jarvis_task_state: {
        Args: { p_task: string }
        Returns: Json
      }
      jarvis_submit_receipt: {
        Args: { p_activity: string; p_device: string; p_receipt: Json }
        Returns: {
          outcome: string
          task_id: string
        }[]
      }
      jarvis_purge_expired_activity: {
        Args: { p_user_id: string }
        Returns: number
      }
      ocade_admin_remove_device: {
        Args: { device: string; remove_reason: string }
        Returns: boolean
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
      ocade_active_entitlement_grant: {
        Args: { target_user: string }
        Returns: {
          ends_at: string
          reason: string
          starts_at: string
          tier: string
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
      ocade_bind_permit_to_task: {
        Args: { p_idempotency_key: string; p_task_id: string; p_user_id: string }
        Returns: string
      }
      ocade_cancel_unsigned_offline_usage: {
        Args: { p_device_id: string; p_lease_id: string; p_user_id: string }
        Returns: number
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
      ocade_begin_mfa_recovery: {
        Args: {
          p_code_hash: string
          p_factor_ids: string[]
          p_session: string | null
          p_user_id: string
        }
        Returns: Json
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
      ocade_support_share: {
        Args: { p_conversation: string; p_hours: number }
        Returns: string
      }
      ocade_support_unshare: {
        Args: { p_conversation: string }
        Returns: undefined
      }
      ocade_finish_mfa_recovery: {
        Args: { p_code_hash: string; p_user_id: string }
        Returns: undefined
      }
      ocade_count_mfa_recovery_codes: {
        Args: { p_user_id: string }
        Returns: {
          generated_at: string
          remaining: number
          total: number
        }[]
      }
      ocade_delete_all_library_items: { Args: never; Returns: number }
      ocade_delete_messages_from: {
        Args: { p_conversation_id: string; p_from: string }
        Returns: number
      }
      ocade_expire_commercial_permits: {
        Args: { p_now?: string; p_user_id: string }
        Returns: number
      }
      ocade_expire_offline_usage_leases: {
        Args: { p_now?: string; p_user_id: string }
        Returns: number
      }
      ocade_factor_added_since_sign_in: {
        Args: { p_unverified_too?: boolean }
        Returns: boolean
      }
      ocade_two_step_set_up_in_this_sign_in: { Args: never; Returns: boolean }
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
      ocade_grant_entitlement: {
        Args: {
          days?: number
          grant_reason: string
          grant_tier: string
          target_user: string
        }
        Returns: {
          created_at: string
          ends_at: string
          granted_by: string
          id: string
          reason: string
          revoked_at: string | null
          revoked_by: string | null
          revoked_reason: string | null
          starts_at: string
          tier: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "ocade_entitlement_grants"
          isOneToOne: true
          isSetofReturn: false
        }
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
      ocade_my_entitlement_grant: {
        Args: never
        Returns: {
          ends_at: string
          reason: string
          starts_at: string
          tier: string
        }[]
      }
      ocade_read_commercial_usage: {
        Args: { p_surface?: string; p_user_id: string }
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
      ocade_read_service_controls: {
        Args: never
        Returns: {
          changed_at: string
          changed_by: string | null
          key: string
          paused: boolean
          reason: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "ocade_service_controls"
          isOneToOne: false
          isSetofReturn: true
        }
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
      ocade_push_subscribe: {
        Args: { p_auth: string; p_endpoint: string; p_p256dh: string }
        Returns: undefined
      }
      ocade_push_unsubscribe: { Args: { p_endpoint: string }; Returns: undefined }
      ocade_record_online_ai_consent: {
        Args: { p_given: boolean; p_version: string }
        Returns: string
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
      ocade_replace_mfa_recovery_codes: {
        Args: { p_code_hashes: string[]; p_user_id: string }
        Returns: number
      }
      ocade_require_recent_strong_auth: {
        Args: { p_action: string }
        Returns: undefined
      }
      ocade_return_offline_usage: {
        Args: { p_device_id: string; p_lease_id: string; p_user_id: string }
        Returns: number
      }
      ocade_revoke_account_session: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: number
      }
      ocade_case_close: { Args: { p_case: string; p_reason: string }; Returns: boolean }
      ocade_case_conversations: {
        Args: { p_customer: string }
        Returns: { id: string; title: string }[]
      }
      ocade_case_messages: {
        Args: { p_case: string; p_conversation: string }
        Returns: { content: string; created_at: string; role: string }[]
      }
      ocade_case_open: {
        Args: {
          p_assignee?: string
          p_conversation: string
          p_customer: string
          p_hours: number
          p_reason: string
        }
        Returns: string
      }
      ocade_my_staff: {
        Args: never
        Returns: { permissions: string[]; role: string; second_factor: boolean }[]
      }
      ocade_staff_can: { Args: { p_permission: string }; Returns: boolean }
      ocade_staff_end_all_sessions: { Args: { p_reason: string }; Returns: number }
      ocade_staff_adjust_usage: {
        Args: {
          p_delta_hundredths: number
          p_reason: string
          p_surface: string
          p_user: string
          p_window_kind: string
        }
        Returns: number
      }
      ocade_staff_begin_account_deletion: {
        Args: { p_email: string; p_reason: string; p_user: string }
        Returns: boolean
      }
      ocade_staff_end_customer_sessions: {
        Args: { p_reason: string; p_user: string }
        Returns: number
      }
      ocade_staff_grant: {
        Args: { p_email: string; p_reason: string; p_role: string }
        Returns: Json
      }
      ocade_staff_role_defaults: {
        Args: never
        Returns: { permissions: string[]; role: string }[]
      }
      ocade_staff_reset_second_factor: {
        Args: { p_reason: string; p_user: string }
        Returns: boolean
      }
      ocade_staff_revoke: { Args: { p_reason: string; p_user: string }; Returns: boolean }
      ocade_grant_unlimited: {
        Args: { p_reason: string; p_until: string; p_user: string }
        Returns: string
      }
      ocade_revoke_unlimited: { Args: { p_reason: string; p_user: string }; Returns: boolean }
      ocade_account_unlimited: {
        Args: { target_user: string }
        Returns: { ends_at: string | null; why: string }[]
      }
      ocade_staff_set_permissions: {
        Args: { p_denied: string[]; p_granted: string[]; p_reason: string; p_user: string }
        Returns: boolean
      }
      ocade_staff_suspend_account: {
        Args: { p_reason: string; p_suspend: boolean; p_user: string }
        Returns: boolean
      }
      ocade_staff_transfer_ownership: {
        Args: { p_reason: string; p_stay_owner?: boolean; p_to: string }
        Returns: boolean
      }
      ocade_staff_withdraw_invite: {
        Args: { p_invite: string; p_reason: string }
        Returns: boolean
      }
      ocade_revoke_entitlement: {
        Args: { grant_id: string; revoke_reason: string }
        Returns: boolean
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
      ocade_session_has_verified_factor: { Args: never; Returns: boolean }
      ocade_session_is_live: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: boolean
      }
      ocade_session_last_proof_at: { Args: never; Returns: string }
      ocade_set_notification_delivery: {
        Args: { p_channel: string; p_id: string; p_state: string }
        Returns: undefined
      }
      ocade_set_service_control: {
        Args: { change_reason: string; control_key: string; pause: boolean }
        Returns: {
          changed_at: string
          changed_by: string | null
          key: string
          paused: boolean
          reason: string | null
        }
        SetofOptions: {
          from: "*"
          to: "ocade_service_controls"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ocade_usage_window_kind: {
        Args: { p_kind: string; p_surface: string }
        Returns: string
      }
      register_browser_device_for_current_user: {
        Args: {
          _browser_install_id: string
          _kind: Database["public"]["Enums"]["device_kind"]
          _name: string
          _origin: string
          _user_agent: string
        }
        Returns: string
      }
      revoke_device_for_current_user: {
        Args: { _device_id: string }
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
      main_purpose_kind: "solo" | "small_business" | "enterprise"
      privacy_mode: "device_only" | "private_sync"
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
      main_purpose_kind: ["solo", "small_business", "enterprise"],
      privacy_mode: ["device_only", "private_sync"],
    },
  },
} as const
