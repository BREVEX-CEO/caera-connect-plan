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
          deleted_at: string | null
          id: string
          model_id: string | null
          pinned: boolean
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
          provider_id?: string | null
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
      ocade_delete_all_library_items: { Args: never; Returns: number }
      ocade_expire_commercial_permits: {
        Args: { p_now?: string; p_user_id: string }
        Returns: number
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
      ocade_cancel_unsigned_offline_usage: {
        Args: { p_device_id: string; p_lease_id: string; p_user_id: string }
        Returns: number
      }
      ocade_return_offline_usage: {
        Args: { p_device_id: string; p_lease_id: string; p_user_id: string }
        Returns: number
      }
      ocade_revoke_account_session: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: number
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
