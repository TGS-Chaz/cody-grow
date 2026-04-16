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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          activity_type: string
          contact_id: string | null
          created_at: string | null
          description: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          activity_type: string
          contact_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          activity_type?: string
          contact_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          org_id: string
          tier: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name?: string
          org_id: string
          tier?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          org_id?: string
          tier?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      avatar_gallery: {
        Row: {
          created_at: string | null
          id: string
          image_url: string
          is_favorite: boolean | null
          org_id: string | null
          prompt: string | null
          style: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url: string
          is_favorite?: boolean | null
          org_id?: string | null
          prompt?: string | null
          style?: string | null
          type?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string
          is_favorite?: boolean | null
          org_id?: string | null
          prompt?: string | null
          style?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avatar_gallery_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      avatar_generations: {
        Row: {
          created_at: string | null
          id: string
          image_url: string | null
          org_id: string | null
          style: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url?: string | null
          org_id?: string | null
          style: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string | null
          org_id?: string | null
          style?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avatar_generations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      beta_requests: {
        Row: {
          company: string | null
          created_at: string | null
          email: string
          id: string
          name: string
          status: string | null
          team_size: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string | null
          email: string
          id?: string
          name: string
          status?: string | null
          team_size?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          status?: string | null
          team_size?: string | null
        }
        Relationships: []
      }
      booking_slots: {
        Row: {
          created_at: string | null
          day_of_week: number
          duration_minutes: number
          end_time: string
          id: string
          org_id: string | null
          start_time: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          duration_minutes?: number
          end_time: string
          id?: string
          org_id?: string | null
          start_time: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          duration_minutes?: number
          end_time?: string
          id?: string
          org_id?: string | null
          start_time?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_slots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_aliases: {
        Row: {
          alias: string
          canonical_name: string
          created_at: string
          id: string
          org_id: string | null
        }
        Insert: {
          alias: string
          canonical_name: string
          created_at?: string
          id?: string
          org_id?: string | null
        }
        Update: {
          alias?: string
          canonical_name?: string
          created_at?: string
          id?: string
          org_id?: string | null
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          contact_id: string | null
          created_at: string | null
          description: string | null
          end_time: string
          event_type: string | null
          google_event_id: string | null
          id: string
          location: string | null
          location_lat: number | null
          location_lng: number | null
          org_id: string | null
          source: string | null
          start_time: string
          synced_at: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          description?: string | null
          end_time: string
          event_type?: string | null
          google_event_id?: string | null
          id?: string
          location?: string | null
          location_lat?: number | null
          location_lng?: number | null
          org_id?: string | null
          source?: string | null
          start_time: string
          synced_at?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          description?: string | null
          end_time?: string
          event_type?: string | null
          google_event_id?: string | null
          id?: string
          location?: string | null
          location_lat?: number | null
          location_lng?: number | null
          org_id?: string | null
          source?: string | null
          start_time?: string
          synced_at?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          body: string
          click_count: number | null
          created_at: string | null
          id: string
          name: string
          open_count: number | null
          org_id: string | null
          recipient_count: number | null
          scheduled_at: string | null
          segment_config: Json | null
          sent_at: string | null
          status: string | null
          subject: string
          user_id: string | null
        }
        Insert: {
          body: string
          click_count?: number | null
          created_at?: string | null
          id?: string
          name: string
          open_count?: number | null
          org_id?: string | null
          recipient_count?: number | null
          scheduled_at?: string | null
          segment_config?: Json | null
          sent_at?: string | null
          status?: string | null
          subject: string
          user_id?: string | null
        }
        Update: {
          body?: string
          click_count?: number | null
          created_at?: string | null
          id?: string
          name?: string
          open_count?: number | null
          org_id?: string | null
          recipient_count?: number | null
          scheduled_at?: string | null
          segment_config?: Json | null
          sent_at?: string | null
          status?: string | null
          subject?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_channels: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_dm: boolean | null
          is_private: boolean | null
          name: string
          org_id: string | null
          slack_channel_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_dm?: boolean | null
          is_private?: boolean | null
          name: string
          org_id?: string | null
          slack_channel_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_dm?: boolean | null
          is_private?: boolean | null
          name?: string
          org_id?: string | null
          slack_channel_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_channels_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cody_conversations: {
        Row: {
          context_id: string | null
          context_type: string | null
          created_at: string | null
          id: string
          org_id: string
          product: string
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          context_id?: string | null
          context_type?: string | null
          created_at?: string | null
          id?: string
          org_id: string
          product: string
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          context_id?: string | null
          context_type?: string | null
          created_at?: string | null
          id?: string
          org_id?: string
          product?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cody_conversations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cody_insights: {
        Row: {
          acted_on_at: string | null
          action_url: string | null
          confidence: number | null
          content: string
          created_at: string | null
          dismissed_at: string | null
          entity_id: string | null
          entity_type: string | null
          expires_at: string | null
          id: string
          insight_type: string
          org_id: string
          product: string
          severity: string | null
          title: string
        }
        Insert: {
          acted_on_at?: string | null
          action_url?: string | null
          confidence?: number | null
          content: string
          created_at?: string | null
          dismissed_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          expires_at?: string | null
          id?: string
          insight_type: string
          org_id: string
          product: string
          severity?: string | null
          title: string
        }
        Update: {
          acted_on_at?: string | null
          action_url?: string | null
          confidence?: number | null
          content?: string
          created_at?: string | null
          dismissed_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          expires_at?: string | null
          id?: string
          insight_type?: string
          org_id?: string
          product?: string
          severity?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "cody_insights_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cody_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          model: string | null
          role: string
          tokens_used: number | null
          tool_calls: Json | null
          tool_results: Json | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          model?: string | null
          role: string
          tokens_used?: number | null
          tool_calls?: Json | null
          tool_results?: Json | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          model?: string | null
          role?: string
          tokens_used?: number | null
          tool_calls?: Json | null
          tool_results?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "cody_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "cody_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      competitive_positions: {
        Row: {
          categories_you_lack: string[] | null
          category_id: string | null
          competitor_brand_count: number | null
          competitor_brands: string[] | null
          created_at: string | null
          dispensary_id: string | null
          id: string
          market_avg_price: number | null
          opportunity_score: number | null
          snapshot_date: string
          your_avg_price: number | null
          your_brand_count: number | null
          your_price_position: string | null
        }
        Insert: {
          categories_you_lack?: string[] | null
          category_id?: string | null
          competitor_brand_count?: number | null
          competitor_brands?: string[] | null
          created_at?: string | null
          dispensary_id?: string | null
          id?: string
          market_avg_price?: number | null
          opportunity_score?: number | null
          snapshot_date?: string
          your_avg_price?: number | null
          your_brand_count?: number | null
          your_price_position?: string | null
        }
        Update: {
          categories_you_lack?: string[] | null
          category_id?: string | null
          competitor_brand_count?: number | null
          competitor_brands?: string[] | null
          created_at?: string | null
          dispensary_id?: string | null
          id?: string
          market_avg_price?: number | null
          opportunity_score?: number | null
          snapshot_date?: string
          your_avg_price?: number | null
          your_brand_count?: number | null
          your_price_position?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competitive_positions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "market_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitive_positions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "mv_category_share"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "competitive_positions_dispensary_id_fkey"
            columns: ["dispensary_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_group_members: {
        Row: {
          contact_id: string | null
          group_id: string | null
          id: string
          org_id: string | null
        }
        Insert: {
          contact_id?: string | null
          group_id?: string | null
          id?: string
          org_id?: string | null
        }
        Update: {
          contact_id?: string | null
          group_id?: string | null
          id?: string
          org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_group_members_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "contact_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_group_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_groups: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          org_id: string | null
          user_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          org_id?: string | null
          user_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          org_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_groups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_sequences: {
        Row: {
          contact_id: string | null
          created_at: string | null
          current_step: number
          id: string
          org_id: string | null
          start_date: string
          status: string
          template_id: string | null
          template_name: string
          updated_at: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          current_step?: number
          id?: string
          org_id?: string | null
          start_date: string
          status?: string
          template_id?: string | null
          template_name: string
          updated_at?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          current_step?: number
          id?: string
          org_id?: string | null
          start_date?: string
          status?: string
          template_id?: string | null
          template_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_sequences_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_sequences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_sequences_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "sequence_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          city: string | null
          company: string | null
          contact_type: string | null
          created_at: string | null
          email: string | null
          id: string
          last_visited: string | null
          lat: number | null
          latitude: number | null
          license_expiry: string | null
          license_number: string | null
          lng: number | null
          longitude: number | null
          name: string
          notes: string | null
          org_id: string | null
          parent_company: string | null
          phone: string | null
          role: string | null
          source: string | null
          state: string | null
          tags: string[] | null
          updated_at: string | null
          visit_frequency_days: number | null
          website: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company?: string | null
          contact_type?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          last_visited?: string | null
          lat?: number | null
          latitude?: number | null
          license_expiry?: string | null
          license_number?: string | null
          lng?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          org_id?: string | null
          parent_company?: string | null
          phone?: string | null
          role?: string | null
          source?: string | null
          state?: string | null
          tags?: string[] | null
          updated_at?: string | null
          visit_frequency_days?: number | null
          website?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company?: string | null
          contact_type?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          last_visited?: string | null
          lat?: number | null
          latitude?: number | null
          license_expiry?: string | null
          license_number?: string | null
          lng?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          org_id?: string | null
          parent_company?: string | null
          phone?: string | null
          role?: string | null
          source?: string | null
          state?: string | null
          tags?: string[] | null
          updated_at?: string | null
          visit_frequency_days?: number | null
          website?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_reports: {
        Row: {
          config: Json
          created_at: string | null
          id: string
          name: string
          org_id: string | null
          user_id: string | null
        }
        Insert: {
          config?: Json
          created_at?: string | null
          id?: string
          name: string
          org_id?: string | null
          user_id?: string | null
        }
        Update: {
          config?: Json
          created_at?: string | null
          id?: string
          name?: string
          org_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_brand_metrics: {
        Row: {
          avg_price: number | null
          brand_name: string
          categories: string[] | null
          date: string
          id: string
          org_id: string | null
          store_count: number | null
          total_products: number | null
        }
        Insert: {
          avg_price?: number | null
          brand_name: string
          categories?: string[] | null
          date: string
          id?: string
          org_id?: string | null
          store_count?: number | null
          total_products?: number | null
        }
        Update: {
          avg_price?: number | null
          brand_name?: string
          categories?: string[] | null
          date?: string
          id?: string
          org_id?: string | null
          store_count?: number | null
          total_products?: number | null
        }
        Relationships: []
      }
      deals: {
        Row: {
          contact_id: string | null
          created_at: string | null
          farm_name: string | null
          id: string
          notes: string | null
          org_id: string | null
          pipeline_id: string | null
          products: string | null
          quantity: number | null
          stage: string | null
          title: string
          updated_at: string | null
          value: number | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          farm_name?: string | null
          id?: string
          notes?: string | null
          org_id?: string | null
          pipeline_id?: string | null
          products?: string | null
          quantity?: number | null
          stage?: string | null
          title: string
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          farm_name?: string | null
          id?: string
          notes?: string | null
          org_id?: string | null
          pipeline_id?: string | null
          products?: string | null
          quantity?: number | null
          stage?: string | null
          title?: string
          updated_at?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      dispensary_menus: {
        Row: {
          created_at: string | null
          dispensary_id: string | null
          id: string
          intel_store_id: string | null
          is_primary: boolean
          last_scraped_at: string | null
          menu_item_count: number | null
          scrape_status: string | null
          source: string
          source_url: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          dispensary_id?: string | null
          id?: string
          intel_store_id?: string | null
          is_primary?: boolean
          last_scraped_at?: string | null
          menu_item_count?: number | null
          scrape_status?: string | null
          source: string
          source_url?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          dispensary_id?: string | null
          id?: string
          intel_store_id?: string | null
          is_primary?: boolean
          last_scraped_at?: string | null
          menu_item_count?: number | null
          scrape_status?: string | null
          source?: string
          source_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dispensary_menus_dispensary_id_fkey"
            columns: ["dispensary_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispensary_menus_intel_store_id_fkey"
            columns: ["intel_store_id"]
            isOneToOne: false
            referencedRelation: "intel_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispensary_menus_intel_store_id_fkey"
            columns: ["intel_store_id"]
            isOneToOne: false
            referencedRelation: "v_intel_store_platform_coverage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispensary_menus_intel_store_id_fkey"
            columns: ["intel_store_id"]
            isOneToOne: false
            referencedRelation: "v_store_platform_crossref"
            referencedColumns: ["id"]
          },
        ]
      }
      email_folders: {
        Row: {
          color: string
          created_at: string | null
          id: string
          name: string
          org_id: string | null
          user_id: string | null
        }
        Insert: {
          color?: string
          created_at?: string | null
          id?: string
          name: string
          org_id?: string | null
          user_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string | null
          id?: string
          name?: string
          org_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_folders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          created_at: string | null
          id: string
          name: string
          org_id: string | null
          subject: string
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          name: string
          org_id?: string | null
          subject: string
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          name?: string
          org_id?: string | null
          subject?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      emails: {
        Row: {
          ai_draft: string | null
          ai_notes: string | null
          ai_summary: string | null
          attachments: Json | null
          bcc: string | null
          body: string | null
          category: string | null
          cc: string | null
          click_count: number | null
          contact_id: string | null
          created_at: string | null
          date: string | null
          draft_status: string | null
          folder_id: string | null
          from_address: string | null
          from_email: string | null
          from_name: string | null
          gmail_id: string | null
          has_attachments: boolean | null
          html_body: string | null
          id: string
          is_draft: boolean | null
          is_read: boolean | null
          is_sent: boolean | null
          labels: string[] | null
          open_count: number | null
          opened_at: string | null
          org_id: string | null
          read: boolean | null
          scheduled_at: string | null
          send_status: string | null
          snippet: string | null
          snoozed_until: string | null
          starred: boolean | null
          subject: string | null
          thread_id: string | null
          to_address: string | null
          to_email: string | null
          tracking_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ai_draft?: string | null
          ai_notes?: string | null
          ai_summary?: string | null
          attachments?: Json | null
          bcc?: string | null
          body?: string | null
          category?: string | null
          cc?: string | null
          click_count?: number | null
          contact_id?: string | null
          created_at?: string | null
          date?: string | null
          draft_status?: string | null
          folder_id?: string | null
          from_address?: string | null
          from_email?: string | null
          from_name?: string | null
          gmail_id?: string | null
          has_attachments?: boolean | null
          html_body?: string | null
          id?: string
          is_draft?: boolean | null
          is_read?: boolean | null
          is_sent?: boolean | null
          labels?: string[] | null
          open_count?: number | null
          opened_at?: string | null
          org_id?: string | null
          read?: boolean | null
          scheduled_at?: string | null
          send_status?: string | null
          snippet?: string | null
          snoozed_until?: string | null
          starred?: boolean | null
          subject?: string | null
          thread_id?: string | null
          to_address?: string | null
          to_email?: string | null
          tracking_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ai_draft?: string | null
          ai_notes?: string | null
          ai_summary?: string | null
          attachments?: Json | null
          bcc?: string | null
          body?: string | null
          category?: string | null
          cc?: string | null
          click_count?: number | null
          contact_id?: string | null
          created_at?: string | null
          date?: string | null
          draft_status?: string | null
          folder_id?: string | null
          from_address?: string | null
          from_email?: string | null
          from_name?: string | null
          gmail_id?: string | null
          has_attachments?: boolean | null
          html_body?: string | null
          id?: string
          is_draft?: boolean | null
          is_read?: boolean | null
          is_sent?: boolean | null
          labels?: string[] | null
          open_count?: number | null
          opened_at?: string | null
          org_id?: string | null
          read?: boolean | null
          scheduled_at?: string | null
          send_status?: string | null
          snippet?: string | null
          snoozed_until?: string | null
          starred?: boolean | null
          subject?: string | null
          thread_id?: string | null
          to_address?: string | null
          to_email?: string | null
          tracking_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emails_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "email_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          contact_id: string | null
          created_at: string | null
          data: Json
          form_id: string | null
          id: string
          org_id: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          data?: Json
          form_id?: string | null
          id?: string
          org_id?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          data?: Json
          form_id?: string | null
          id?: string
          org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "lead_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_tokens: {
        Row: {
          access_token: string
          created_at: string | null
          email: string | null
          expires_at: string
          id: string
          last_history_id: string | null
          refresh_token: string
          sync_page_token: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          access_token: string
          created_at?: string | null
          email?: string | null
          expires_at: string
          id?: string
          last_history_id?: string | null
          refresh_token: string
          sync_page_token?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          last_history_id?: string | null
          refresh_token?: string
          sync_page_token?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      grow_account_groups: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          org_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          org_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grow_account_groups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      grow_accounts: {
        Row: {
          account_group_id: string | null
          address_line1: string | null
          address_line2: string | null
          assigned_rep_id: string | null
          city: string | null
          company_name: string
          created_at: string | null
          created_by: string | null
          crm_company_id: string | null
          crm_contact_id: string | null
          dba: string | null
          delivery_route: string | null
          id: string
          is_active: boolean | null
          is_non_cannabis: boolean | null
          label_barcode_preference: string | null
          license_number: string | null
          license_type: string | null
          notes: string | null
          org_id: string
          payment_terms: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          state: string | null
          tags: string[] | null
          updated_at: string | null
          workflow_status: string | null
          zip: string | null
        }
        Insert: {
          account_group_id?: string | null
          address_line1?: string | null
          address_line2?: string | null
          assigned_rep_id?: string | null
          city?: string | null
          company_name: string
          created_at?: string | null
          created_by?: string | null
          crm_company_id?: string | null
          crm_contact_id?: string | null
          dba?: string | null
          delivery_route?: string | null
          id?: string
          is_active?: boolean | null
          is_non_cannabis?: boolean | null
          label_barcode_preference?: string | null
          license_number?: string | null
          license_type?: string | null
          notes?: string | null
          org_id: string
          payment_terms?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          state?: string | null
          tags?: string[] | null
          updated_at?: string | null
          workflow_status?: string | null
          zip?: string | null
        }
        Update: {
          account_group_id?: string | null
          address_line1?: string | null
          address_line2?: string | null
          assigned_rep_id?: string | null
          city?: string | null
          company_name?: string
          created_at?: string | null
          created_by?: string | null
          crm_company_id?: string | null
          crm_contact_id?: string | null
          dba?: string | null
          delivery_route?: string | null
          id?: string
          is_active?: boolean | null
          is_non_cannabis?: boolean | null
          label_barcode_preference?: string | null
          license_number?: string | null
          license_type?: string | null
          notes?: string | null
          org_id?: string
          payment_terms?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          state?: string | null
          tags?: string[] | null
          updated_at?: string | null
          workflow_status?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grow_accounts_account_group_id_fkey"
            columns: ["account_group_id"]
            isOneToOne: false
            referencedRelation: "grow_account_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      grow_areas: {
        Row: {
          created_at: string | null
          created_by: string | null
          external_id: string
          facility_id: string | null
          id: string
          is_active: boolean | null
          is_quarantine: boolean | null
          name: string
          notes: string | null
          org_id: string
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          external_id: string
          facility_id?: string | null
          id?: string
          is_active?: boolean | null
          is_quarantine?: boolean | null
          name: string
          notes?: string | null
          org_id: string
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          external_id?: string
          facility_id?: string | null
          id?: string
          is_active?: boolean | null
          is_quarantine?: boolean | null
          name?: string
          notes?: string | null
          org_id?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grow_areas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      grow_audit_log: {
        Row: {
          action: string
          changes_json: Json | null
          created_at: string | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
          ip_address: string | null
          org_id: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changes_json?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          org_id: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changes_json?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          org_id?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grow_audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      grow_batches: {
        Row: {
          area_id: string | null
          barcode: string
          created_at: string | null
          created_by: string | null
          current_quantity: number
          current_weight_grams: number | null
          expiration_date: string | null
          external_id: string
          harvest_id: string | null
          id: string
          initial_quantity: number
          initial_weight_grams: number | null
          is_available: boolean | null
          is_doh_compliant: boolean | null
          is_employee_sample: boolean | null
          is_marketplace: boolean | null
          is_non_cannabis: boolean | null
          is_pack_to_order: boolean | null
          is_trade_sample: boolean | null
          notes: string | null
          org_id: string
          packaged_date: string | null
          parent_batch_id: string | null
          procurement_farm: string | null
          procurement_license: string | null
          product_id: string | null
          production_run_id: string | null
          qa_parent_batch_id: string | null
          source_type: string | null
          strain_id: string | null
          unit_cost: number | null
          updated_at: string | null
        }
        Insert: {
          area_id?: string | null
          barcode: string
          created_at?: string | null
          created_by?: string | null
          current_quantity: number
          current_weight_grams?: number | null
          expiration_date?: string | null
          external_id: string
          harvest_id?: string | null
          id?: string
          initial_quantity: number
          initial_weight_grams?: number | null
          is_available?: boolean | null
          is_doh_compliant?: boolean | null
          is_employee_sample?: boolean | null
          is_marketplace?: boolean | null
          is_non_cannabis?: boolean | null
          is_pack_to_order?: boolean | null
          is_trade_sample?: boolean | null
          notes?: string | null
          org_id: string
          packaged_date?: string | null
          parent_batch_id?: string | null
          procurement_farm?: string | null
          procurement_license?: string | null
          product_id?: string | null
          production_run_id?: string | null
          qa_parent_batch_id?: string | null
          source_type?: string | null
          strain_id?: string | null
          unit_cost?: number | null
          updated_at?: string | null
        }
        Update: {
          area_id?: string | null
          barcode?: string
          created_at?: string | null
          created_by?: string | null
          current_quantity?: number
          current_weight_grams?: number | null
          expiration_date?: string | null
          external_id?: string
          harvest_id?: string | null
          id?: string
          initial_quantity?: number
          initial_weight_grams?: number | null
          is_available?: boolean | null
          is_doh_compliant?: boolean | null
          is_employee_sample?: boolean | null
          is_marketplace?: boolean | null
          is_non_cannabis?: boolean | null
          is_pack_to_order?: boolean | null
          is_trade_sample?: boolean | null
          notes?: string | null
          org_id?: string
          packaged_date?: string | null
          parent_batch_id?: string | null
          procurement_farm?: string | null
          procurement_license?: string | null
          product_id?: string | null
          production_run_id?: string | null
          qa_parent_batch_id?: string | null
          source_type?: string | null
          strain_id?: string | null
          unit_cost?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_grow_batches_production_run"
            columns: ["production_run_id"]
            isOneToOne: false
            referencedRelation: "grow_production_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_batches_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "grow_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_batches_harvest_id_fkey"
            columns: ["harvest_id"]
            isOneToOne: false
            referencedRelation: "grow_harvests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_batches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_batches_parent_batch_id_fkey"
            columns: ["parent_batch_id"]
            isOneToOne: false
            referencedRelation: "grow_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "grow_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_batches_qa_parent_batch_id_fkey"
            columns: ["qa_parent_batch_id"]
            isOneToOne: false
            referencedRelation: "grow_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_batches_strain_id_fkey"
            columns: ["strain_id"]
            isOneToOne: false
            referencedRelation: "grow_strains"
            referencedColumns: ["id"]
          },
        ]
      }
      grow_board_cards: {
        Row: {
          column_name: string
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          notes: string | null
          org_id: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          column_name: string
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          notes?: string | null
          org_id: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          column_name?: string
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          notes?: string | null
          org_id?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grow_board_cards_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      grow_bom_inputs: {
        Row: {
          bom_id: string
          id: string
          input_category: string
          notes: string | null
          sort_order: number | null
        }
        Insert: {
          bom_id: string
          id?: string
          input_category: string
          notes?: string | null
          sort_order?: number | null
        }
        Update: {
          bom_id?: string
          id?: string
          input_category?: string
          notes?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "grow_bom_inputs_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "grow_boms"
            referencedColumns: ["id"]
          },
        ]
      }
      grow_boms: {
        Row: {
          byproduct_category: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          org_id: string
          output_category: string | null
          output_product_id: string | null
          updated_at: string | null
        }
        Insert: {
          byproduct_category?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          org_id: string
          output_category?: string | null
          output_product_id?: string | null
          updated_at?: string | null
        }
        Update: {
          byproduct_category?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          org_id?: string
          output_category?: string | null
          output_product_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grow_boms_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_boms_output_product_id_fkey"
            columns: ["output_product_id"]
            isOneToOne: false
            referencedRelation: "grow_products"
            referencedColumns: ["id"]
          },
        ]
      }
      grow_ccrs_uploads: {
        Row: {
          confirmed_at: string | null
          created_at: string | null
          created_by: string | null
          error_message: string | null
          file_name: string
          file_type: string
          generated_at: string | null
          id: string
          org_id: string
          record_count: number
          records_json: Json | null
          status: string | null
          uploaded_at: string | null
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          file_name: string
          file_type: string
          generated_at?: string | null
          id?: string
          org_id: string
          record_count: number
          records_json?: Json | null
          status?: string | null
          uploaded_at?: string | null
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          file_name?: string
          file_type?: string
          generated_at?: string | null
          id?: string
          org_id?: string
          record_count?: number
          records_json?: Json | null
          status?: string | null
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grow_ccrs_uploads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      grow_cycles: {
        Row: {
          actual_harvest_date: string | null
          area_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          notes: string | null
          org_id: string
          phase: string
          plant_count: number | null
          start_date: string
          strain_id: string
          target_harvest_date: string | null
          updated_at: string | null
        }
        Insert: {
          actual_harvest_date?: string | null
          area_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          org_id: string
          phase?: string
          plant_count?: number | null
          start_date?: string
          strain_id: string
          target_harvest_date?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_harvest_date?: string | null
          area_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          org_id?: string
          phase?: string
          plant_count?: number | null
          start_date?: string
          strain_id?: string
          target_harvest_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grow_cycles_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "grow_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_cycles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_cycles_strain_id_fkey"
            columns: ["strain_id"]
            isOneToOne: false
            referencedRelation: "grow_strains"
            referencedColumns: ["id"]
          },
        ]
      }
      grow_environmental_readings: {
        Row: {
          area_id: string
          co2_ppm: number | null
          humidity_pct: number | null
          id: string
          light_ppfd: number | null
          org_id: string
          recorded_at: string | null
          temperature_f: number | null
          vpd: number | null
        }
        Insert: {
          area_id: string
          co2_ppm?: number | null
          humidity_pct?: number | null
          id?: string
          light_ppfd?: number | null
          org_id: string
          recorded_at?: string | null
          temperature_f?: number | null
          vpd?: number | null
        }
        Update: {
          area_id?: string
          co2_ppm?: number | null
          humidity_pct?: number | null
          id?: string
          light_ppfd?: number | null
          org_id?: string
          recorded_at?: string | null
          temperature_f?: number | null
          vpd?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "grow_environmental_readings_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "grow_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_environmental_readings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      grow_harvest_plants: {
        Row: {
          created_at: string | null
          harvest_id: string
          id: string
          plant_id: string
          wet_weight_grams: number | null
        }
        Insert: {
          created_at?: string | null
          harvest_id: string
          id?: string
          plant_id: string
          wet_weight_grams?: number | null
        }
        Update: {
          created_at?: string | null
          harvest_id?: string
          id?: string
          plant_id?: string
          wet_weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "grow_harvest_plants_harvest_id_fkey"
            columns: ["harvest_id"]
            isOneToOne: false
            referencedRelation: "grow_harvests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_harvest_plants_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "grow_plants"
            referencedColumns: ["id"]
          },
        ]
      }
      grow_harvests: {
        Row: {
          area_id: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          cure_started_at: string | null
          cured_at: string | null
          dry_weight_grams: number | null
          grow_cycle_id: string | null
          harvest_started_at: string | null
          harvest_type: string
          id: string
          name: string
          notes: string | null
          org_id: string
          status: string | null
          strain_id: string
          updated_at: string | null
          waste_weight_grams: number | null
          wet_weight_grams: number | null
        }
        Insert: {
          area_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          cure_started_at?: string | null
          cured_at?: string | null
          dry_weight_grams?: number | null
          grow_cycle_id?: string | null
          harvest_started_at?: string | null
          harvest_type: string
          id?: string
          name: string
          notes?: string | null
          org_id: string
          status?: string | null
          strain_id: string
          updated_at?: string | null
          waste_weight_grams?: number | null
          wet_weight_grams?: number | null
        }
        Update: {
          area_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          cure_started_at?: string | null
          cured_at?: string | null
          dry_weight_grams?: number | null
          grow_cycle_id?: string | null
          harvest_started_at?: string | null
          harvest_type?: string
          id?: string
          name?: string
          notes?: string | null
          org_id?: string
          status?: string | null
          strain_id?: string
          updated_at?: string | null
          waste_weight_grams?: number | null
          wet_weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "grow_harvests_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "grow_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_harvests_grow_cycle_id_fkey"
            columns: ["grow_cycle_id"]
            isOneToOne: false
            referencedRelation: "grow_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_harvests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_harvests_strain_id_fkey"
            columns: ["strain_id"]
            isOneToOne: false
            referencedRelation: "grow_strains"
            referencedColumns: ["id"]
          },
        ]
      }
      grow_label_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          layout_config: Json
          name: string
          org_id: string
          preview_url: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          layout_config: Json
          name: string
          org_id: string
          preview_url?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          layout_config?: Json
          name?: string
          org_id?: string
          preview_url?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grow_label_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      grow_manifest_items: {
        Row: {
          accepted_quantity: number | null
          batch_id: string | null
          id: string
          manifest_id: string
          plant_id: string | null
          quantity: number
          rejected_quantity: number | null
          servings_per_unit: number | null
          sort_order: number | null
          unit_price: number | null
        }
        Insert: {
          accepted_quantity?: number | null
          batch_id?: string | null
          id?: string
          manifest_id: string
          plant_id?: string | null
          quantity: number
          rejected_quantity?: number | null
          servings_per_unit?: number | null
          sort_order?: number | null
          unit_price?: number | null
        }
        Update: {
          accepted_quantity?: number | null
          batch_id?: string | null
          id?: string
          manifest_id?: string
          plant_id?: string | null
          quantity?: number
          rejected_quantity?: number | null
          servings_per_unit?: number | null
          sort_order?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "grow_manifest_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "grow_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_manifest_items_manifest_id_fkey"
            columns: ["manifest_id"]
            isOneToOne: false
            referencedRelation: "grow_manifests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_manifest_items_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "grow_plants"
            referencedColumns: ["id"]
          },
        ]
      }
      grow_manifests: {
        Row: {
          arrival_datetime: string | null
          ccrs_confirmed_at: string | null
          ccrs_manifest_pdf_url: string | null
          ccrs_submitted_at: string | null
          created_at: string | null
          created_by: string | null
          departure_datetime: string | null
          destination_address: string | null
          destination_email: string | null
          destination_license_name: string | null
          destination_license_number: string
          destination_phone: string | null
          driver_license_number: string | null
          driver_name: string | null
          driver_phone: string | null
          external_id: string
          id: string
          manifest_type: string
          notes: string | null
          order_id: string | null
          org_id: string
          origin_address: string | null
          origin_email: string | null
          origin_license_name: string | null
          origin_license_number: string
          origin_phone: string | null
          status: string | null
          transportation_type: string | null
          transporter_license_number: string | null
          updated_at: string | null
          vehicle_color: string | null
          vehicle_license_plate: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_vin: string | null
          vehicle_year: string | null
          wcia_json_data: Json | null
          wcia_json_url: string | null
        }
        Insert: {
          arrival_datetime?: string | null
          ccrs_confirmed_at?: string | null
          ccrs_manifest_pdf_url?: string | null
          ccrs_submitted_at?: string | null
          created_at?: string | null
          created_by?: string | null
          departure_datetime?: string | null
          destination_address?: string | null
          destination_email?: string | null
          destination_license_name?: string | null
          destination_license_number: string
          destination_phone?: string | null
          driver_license_number?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          external_id: string
          id?: string
          manifest_type: string
          notes?: string | null
          order_id?: string | null
          org_id: string
          origin_address?: string | null
          origin_email?: string | null
          origin_license_name?: string | null
          origin_license_number: string
          origin_phone?: string | null
          status?: string | null
          transportation_type?: string | null
          transporter_license_number?: string | null
          updated_at?: string | null
          vehicle_color?: string | null
          vehicle_license_plate?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_vin?: string | null
          vehicle_year?: string | null
          wcia_json_data?: Json | null
          wcia_json_url?: string | null
        }
        Update: {
          arrival_datetime?: string | null
          ccrs_confirmed_at?: string | null
          ccrs_manifest_pdf_url?: string | null
          ccrs_submitted_at?: string | null
          created_at?: string | null
          created_by?: string | null
          departure_datetime?: string | null
          destination_address?: string | null
          destination_email?: string | null
          destination_license_name?: string | null
          destination_license_number?: string
          destination_phone?: string | null
          driver_license_number?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          external_id?: string
          id?: string
          manifest_type?: string
          notes?: string | null
          order_id?: string | null
          org_id?: string
          origin_address?: string | null
          origin_email?: string | null
          origin_license_name?: string | null
          origin_license_number?: string
          origin_phone?: string | null
          status?: string | null
          transportation_type?: string | null
          transporter_license_number?: string | null
          updated_at?: string | null
          vehicle_color?: string | null
          vehicle_license_plate?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_vin?: string | null
          vehicle_year?: string | null
          wcia_json_data?: Json | null
          wcia_json_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grow_manifests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "grow_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_manifests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      grow_order_allocations: {
        Row: {
          batch_id: string
          created_at: string | null
          id: string
          new_barcode: string | null
          order_item_id: string
          quantity: number
        }
        Insert: {
          batch_id: string
          created_at?: string | null
          id?: string
          new_barcode?: string | null
          order_item_id: string
          quantity: number
        }
        Update: {
          batch_id?: string
          created_at?: string | null
          id?: string
          new_barcode?: string | null
          order_item_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "grow_order_allocations_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "grow_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_order_allocations_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "grow_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      grow_order_items: {
        Row: {
          discount_amount: number | null
          id: string
          line_total: number
          notes: string | null
          order_id: string
          product_id: string
          quantity: number
          sort_order: number | null
          unit_price: number
        }
        Insert: {
          discount_amount?: number | null
          id?: string
          line_total: number
          notes?: string | null
          order_id: string
          product_id: string
          quantity: number
          sort_order?: number | null
          unit_price: number
        }
        Update: {
          discount_amount?: number | null
          id?: string
          line_total?: number
          notes?: string | null
          order_id?: string
          product_id?: string
          quantity?: number
          sort_order?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "grow_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "grow_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "grow_products"
            referencedColumns: ["id"]
          },
        ]
      }
      grow_orders: {
        Row: {
          account_id: string
          charges_total: number | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          discount_total: number | null
          id: string
          is_non_cannabis: boolean | null
          is_trade_sample: boolean | null
          manifested_at: string | null
          notes: string | null
          order_number: string
          org_id: string
          released_at: string | null
          status: string | null
          submitted_at: string | null
          subtotal: number | null
          tax_total: number | null
          total: number | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          charges_total?: number | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          discount_total?: number | null
          id?: string
          is_non_cannabis?: boolean | null
          is_trade_sample?: boolean | null
          manifested_at?: string | null
          notes?: string | null
          order_number: string
          org_id: string
          released_at?: string | null
          status?: string | null
          submitted_at?: string | null
          subtotal?: number | null
          tax_total?: number | null
          total?: number | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          charges_total?: number | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          discount_total?: number | null
          id?: string
          is_non_cannabis?: boolean | null
          is_trade_sample?: boolean | null
          manifested_at?: string | null
          notes?: string | null
          order_number?: string
          org_id?: string
          released_at?: string | null
          status?: string | null
          submitted_at?: string | null
          subtotal?: number | null
          tax_total?: number | null
          total?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grow_orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "grow_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      grow_plants: {
        Row: {
          area_id: string | null
          created_at: string | null
          created_by: string | null
          destroyed_at: string | null
          destruction_reason: string | null
          external_id: string
          grow_cycle_id: string | null
          harvest_date: string | null
          id: string
          is_mother: boolean | null
          mother_plant_id: string | null
          notes: string | null
          org_id: string
          phase: string
          phase_changed_at: string | null
          source_type: string | null
          strain_id: string
          updated_at: string | null
          waste_grams: number | null
        }
        Insert: {
          area_id?: string | null
          created_at?: string | null
          created_by?: string | null
          destroyed_at?: string | null
          destruction_reason?: string | null
          external_id: string
          grow_cycle_id?: string | null
          harvest_date?: string | null
          id?: string
          is_mother?: boolean | null
          mother_plant_id?: string | null
          notes?: string | null
          org_id: string
          phase?: string
          phase_changed_at?: string | null
          source_type?: string | null
          strain_id: string
          updated_at?: string | null
          waste_grams?: number | null
        }
        Update: {
          area_id?: string | null
          created_at?: string | null
          created_by?: string | null
          destroyed_at?: string | null
          destruction_reason?: string | null
          external_id?: string
          grow_cycle_id?: string | null
          harvest_date?: string | null
          id?: string
          is_mother?: boolean | null
          mother_plant_id?: string | null
          notes?: string | null
          org_id?: string
          phase?: string
          phase_changed_at?: string | null
          source_type?: string | null
          strain_id?: string
          updated_at?: string | null
          waste_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "grow_plants_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "grow_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_plants_grow_cycle_id_fkey"
            columns: ["grow_cycle_id"]
            isOneToOne: false
            referencedRelation: "grow_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_plants_mother_plant_id_fkey"
            columns: ["mother_plant_id"]
            isOneToOne: false
            referencedRelation: "grow_plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_plants_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_plants_strain_id_fkey"
            columns: ["strain_id"]
            isOneToOne: false
            referencedRelation: "grow_strains"
            referencedColumns: ["id"]
          },
        ]
      }
      grow_product_lines: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          org_id: string
          parent_id: string | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          org_id: string
          parent_id?: string | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          org_id?: string
          parent_id?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "grow_product_lines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_product_lines_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "grow_product_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      grow_production_inputs: {
        Row: {
          batch_id: string
          created_at: string | null
          id: string
          production_run_id: string
          quantity_used: number
          weight_used_grams: number | null
        }
        Insert: {
          batch_id: string
          created_at?: string | null
          id?: string
          production_run_id: string
          quantity_used: number
          weight_used_grams?: number | null
        }
        Update: {
          batch_id?: string
          created_at?: string | null
          id?: string
          production_run_id?: string
          quantity_used?: number
          weight_used_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "grow_production_inputs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "grow_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_production_inputs_production_run_id_fkey"
            columns: ["production_run_id"]
            isOneToOne: false
            referencedRelation: "grow_production_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      grow_production_runs: {
        Row: {
          area_id: string | null
          bom_id: string | null
          created_at: string | null
          created_by: string | null
          finalized_at: string | null
          id: string
          name: string
          notes: string | null
          org_id: string
          output_batch_id: string | null
          output_product_id: string
          planned_date: string | null
          requires_new_qa: boolean | null
          started_at: string | null
          status: string | null
          updated_at: string | null
          waste_weight_grams: number | null
          yield_quantity: number | null
          yield_weight_grams: number | null
        }
        Insert: {
          area_id?: string | null
          bom_id?: string | null
          created_at?: string | null
          created_by?: string | null
          finalized_at?: string | null
          id?: string
          name: string
          notes?: string | null
          org_id: string
          output_batch_id?: string | null
          output_product_id: string
          planned_date?: string | null
          requires_new_qa?: boolean | null
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
          waste_weight_grams?: number | null
          yield_quantity?: number | null
          yield_weight_grams?: number | null
        }
        Update: {
          area_id?: string | null
          bom_id?: string | null
          created_at?: string | null
          created_by?: string | null
          finalized_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          org_id?: string
          output_batch_id?: string | null
          output_product_id?: string
          planned_date?: string | null
          requires_new_qa?: boolean | null
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
          waste_weight_grams?: number | null
          yield_quantity?: number | null
          yield_weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "grow_production_runs_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "grow_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_production_runs_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "grow_boms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_production_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_production_runs_output_batch_id_fkey"
            columns: ["output_batch_id"]
            isOneToOne: false
            referencedRelation: "grow_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_production_runs_output_product_id_fkey"
            columns: ["output_product_id"]
            isOneToOne: false
            referencedRelation: "grow_products"
            referencedColumns: ["id"]
          },
        ]
      }
      grow_products: {
        Row: {
          category: string
          created_at: string | null
          created_by: string | null
          description: string | null
          external_id: string
          id: string
          image_url: string | null
          is_available: boolean | null
          is_discontinued: boolean | null
          is_marketplace: boolean | null
          label_template_id: string | null
          name: string
          org_id: string
          package_size: string | null
          product_line_id: string | null
          servings_per_unit: number | null
          strain_id: string | null
          unit_weight_grams: number | null
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          external_id: string
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          is_discontinued?: boolean | null
          is_marketplace?: boolean | null
          label_template_id?: string | null
          name: string
          org_id: string
          package_size?: string | null
          product_line_id?: string | null
          servings_per_unit?: number | null
          strain_id?: string | null
          unit_weight_grams?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          external_id?: string
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          is_discontinued?: boolean | null
          is_marketplace?: boolean | null
          label_template_id?: string | null
          name?: string
          org_id?: string
          package_size?: string | null
          product_line_id?: string | null
          servings_per_unit?: number | null
          strain_id?: string | null
          unit_weight_grams?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grow_products_label_template_id_fkey"
            columns: ["label_template_id"]
            isOneToOne: false
            referencedRelation: "grow_label_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_products_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_products_product_line_id_fkey"
            columns: ["product_line_id"]
            isOneToOne: false
            referencedRelation: "grow_product_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_products_strain_id_fkey"
            columns: ["strain_id"]
            isOneToOne: false
            referencedRelation: "grow_strains"
            referencedColumns: ["id"]
          },
        ]
      }
      grow_qa_lots: {
        Row: {
          created_at: string | null
          created_by: string | null
          external_id: string
          id: string
          lot_number: string
          lot_weight_grams: number | null
          notes: string | null
          org_id: string
          parent_batch_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          external_id: string
          id?: string
          lot_number: string
          lot_weight_grams?: number | null
          notes?: string | null
          org_id: string
          parent_batch_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          external_id?: string
          id?: string
          lot_number?: string
          lot_weight_grams?: number | null
          notes?: string | null
          org_id?: string
          parent_batch_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grow_qa_lots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_qa_lots_parent_batch_id_fkey"
            columns: ["parent_batch_id"]
            isOneToOne: false
            referencedRelation: "grow_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      grow_qa_results: {
        Row: {
          ai_extracted_confidence: number | null
          cbd_a_pct: number | null
          cbd_total_pct: number | null
          cbg_pct: number | null
          cbn_pct: number | null
          coa_urls: string[] | null
          created_at: string | null
          created_by: string | null
          expiration_date: string | null
          foreign_matter_pass: boolean | null
          full_results_json: Json | null
          heavy_metals_pass: boolean | null
          id: string
          lab_license_number: string | null
          lab_name: string | null
          microbials_pass: boolean | null
          moisture_pct: number | null
          mycotoxins_pass: boolean | null
          notes: string | null
          org_id: string
          overall_pass: boolean | null
          pesticides_pass: boolean | null
          qa_lot_id: string
          qa_sample_id: string | null
          residual_solvents_pass: boolean | null
          source_type: string | null
          terpene_data: Json | null
          test_date: string
          thc_a_pct: number | null
          thc_delta9_pct: number | null
          thc_total_pct: number | null
          total_terpenes_pct: number | null
          updated_at: string | null
          water_activity: number | null
          wcia_json_source: string | null
        }
        Insert: {
          ai_extracted_confidence?: number | null
          cbd_a_pct?: number | null
          cbd_total_pct?: number | null
          cbg_pct?: number | null
          cbn_pct?: number | null
          coa_urls?: string[] | null
          created_at?: string | null
          created_by?: string | null
          expiration_date?: string | null
          foreign_matter_pass?: boolean | null
          full_results_json?: Json | null
          heavy_metals_pass?: boolean | null
          id?: string
          lab_license_number?: string | null
          lab_name?: string | null
          microbials_pass?: boolean | null
          moisture_pct?: number | null
          mycotoxins_pass?: boolean | null
          notes?: string | null
          org_id: string
          overall_pass?: boolean | null
          pesticides_pass?: boolean | null
          qa_lot_id: string
          qa_sample_id?: string | null
          residual_solvents_pass?: boolean | null
          source_type?: string | null
          terpene_data?: Json | null
          test_date: string
          thc_a_pct?: number | null
          thc_delta9_pct?: number | null
          thc_total_pct?: number | null
          total_terpenes_pct?: number | null
          updated_at?: string | null
          water_activity?: number | null
          wcia_json_source?: string | null
        }
        Update: {
          ai_extracted_confidence?: number | null
          cbd_a_pct?: number | null
          cbd_total_pct?: number | null
          cbg_pct?: number | null
          cbn_pct?: number | null
          coa_urls?: string[] | null
          created_at?: string | null
          created_by?: string | null
          expiration_date?: string | null
          foreign_matter_pass?: boolean | null
          full_results_json?: Json | null
          heavy_metals_pass?: boolean | null
          id?: string
          lab_license_number?: string | null
          lab_name?: string | null
          microbials_pass?: boolean | null
          moisture_pct?: number | null
          mycotoxins_pass?: boolean | null
          notes?: string | null
          org_id?: string
          overall_pass?: boolean | null
          pesticides_pass?: boolean | null
          qa_lot_id?: string
          qa_sample_id?: string | null
          residual_solvents_pass?: boolean | null
          source_type?: string | null
          terpene_data?: Json | null
          test_date?: string
          thc_a_pct?: number | null
          thc_delta9_pct?: number | null
          thc_total_pct?: number | null
          total_terpenes_pct?: number | null
          updated_at?: string | null
          water_activity?: number | null
          wcia_json_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grow_qa_results_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_qa_results_qa_lot_id_fkey"
            columns: ["qa_lot_id"]
            isOneToOne: false
            referencedRelation: "grow_qa_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_qa_results_qa_sample_id_fkey"
            columns: ["qa_sample_id"]
            isOneToOne: false
            referencedRelation: "grow_qa_samples"
            referencedColumns: ["id"]
          },
        ]
      }
      grow_qa_samples: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          id: string
          lab_license_number: string | null
          lab_name: string | null
          manifest_id: string | null
          org_id: string
          qa_lot_id: string
          received_at_lab_at: string | null
          sample_weight_grams: number
          sent_at: string | null
          status: string | null
          updated_at: string | null
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          lab_license_number?: string | null
          lab_name?: string | null
          manifest_id?: string | null
          org_id: string
          qa_lot_id: string
          received_at_lab_at?: string | null
          sample_weight_grams: number
          sent_at?: string | null
          status?: string | null
          updated_at?: string | null
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          lab_license_number?: string | null
          lab_name?: string | null
          manifest_id?: string | null
          org_id?: string
          qa_lot_id?: string
          received_at_lab_at?: string | null
          sample_weight_grams?: number
          sent_at?: string | null
          status?: string | null
          updated_at?: string | null
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_qa_samples_manifest"
            columns: ["manifest_id"]
            isOneToOne: false
            referencedRelation: "grow_manifests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_qa_samples_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_qa_samples_qa_lot_id_fkey"
            columns: ["qa_lot_id"]
            isOneToOne: false
            referencedRelation: "grow_qa_lots"
            referencedColumns: ["id"]
          },
        ]
      }
      grow_saved_views: {
        Row: {
          created_at: string | null
          filter_config: Json
          id: string
          is_default: boolean | null
          is_shared: boolean | null
          name: string
          org_id: string
          page_key: string
          sort_config: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          filter_config: Json
          id?: string
          is_default?: boolean | null
          is_shared?: boolean | null
          name: string
          org_id: string
          page_key: string
          sort_config?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          filter_config?: Json
          id?: string
          is_default?: boolean | null
          is_shared?: boolean | null
          name?: string
          org_id?: string
          page_key?: string
          sort_config?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grow_saved_views_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      grow_sources: {
        Row: {
          acquired_date: string | null
          area_id: string | null
          batch_id: string | null
          created_at: string | null
          created_by: string | null
          current_quantity: number
          external_id: string
          id: string
          initial_quantity: number
          is_active: boolean | null
          mother_plant_id: string | null
          notes: string | null
          org_id: string
          source_type: string
          source_vendor: string | null
          strain_id: string
          updated_at: string | null
        }
        Insert: {
          acquired_date?: string | null
          area_id?: string | null
          batch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          current_quantity: number
          external_id: string
          id?: string
          initial_quantity: number
          is_active?: boolean | null
          mother_plant_id?: string | null
          notes?: string | null
          org_id: string
          source_type: string
          source_vendor?: string | null
          strain_id: string
          updated_at?: string | null
        }
        Update: {
          acquired_date?: string | null
          area_id?: string | null
          batch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          current_quantity?: number
          external_id?: string
          id?: string
          initial_quantity?: number
          is_active?: boolean | null
          mother_plant_id?: string | null
          notes?: string | null
          org_id?: string
          source_type?: string
          source_vendor?: string | null
          strain_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grow_sources_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "grow_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_sources_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "grow_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_sources_mother_plant_id_fkey"
            columns: ["mother_plant_id"]
            isOneToOne: false
            referencedRelation: "grow_plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_sources_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_sources_strain_id_fkey"
            columns: ["strain_id"]
            isOneToOne: false
            referencedRelation: "grow_strains"
            referencedColumns: ["id"]
          },
        ]
      }
      grow_strains: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          external_id: string
          id: string
          is_active: boolean | null
          name: string
          org_id: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          external_id: string
          id?: string
          is_active?: boolean | null
          name: string
          org_id: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          external_id?: string
          id?: string
          is_active?: boolean | null
          name?: string
          org_id?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grow_strains_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      grow_tag_assignments: {
        Row: {
          created_at: string | null
          created_by: string | null
          entity_id: string
          entity_type: string
          id: string
          tag_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
          tag_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grow_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "grow_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      grow_tags: {
        Row: {
          color: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          name: string
          org_id: string
        }
        Insert: {
          color?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          org_id: string
        }
        Update: {
          color?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grow_tags_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      grow_transfer_inbound_items: {
        Row: {
          id: string
          incoming_barcode: string | null
          incoming_external_id: string | null
          notes: string | null
          product_id: string | null
          product_name: string
          qa_result_data: Json | null
          quantity_accepted: number | null
          quantity_rejected: number | null
          quantity_sent: number
          resulting_batch_id: string | null
          sort_order: number | null
          strain_name: string | null
          transfer_id: string
          unit_cost: number | null
        }
        Insert: {
          id?: string
          incoming_barcode?: string | null
          incoming_external_id?: string | null
          notes?: string | null
          product_id?: string | null
          product_name: string
          qa_result_data?: Json | null
          quantity_accepted?: number | null
          quantity_rejected?: number | null
          quantity_sent: number
          resulting_batch_id?: string | null
          sort_order?: number | null
          strain_name?: string | null
          transfer_id: string
          unit_cost?: number | null
        }
        Update: {
          id?: string
          incoming_barcode?: string | null
          incoming_external_id?: string | null
          notes?: string | null
          product_id?: string | null
          product_name?: string
          qa_result_data?: Json | null
          quantity_accepted?: number | null
          quantity_rejected?: number | null
          quantity_sent?: number
          resulting_batch_id?: string | null
          sort_order?: number | null
          strain_name?: string | null
          transfer_id?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "grow_transfer_inbound_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "grow_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_transfer_inbound_items_resulting_batch_id_fkey"
            columns: ["resulting_batch_id"]
            isOneToOne: false
            referencedRelation: "grow_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_transfer_inbound_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "grow_transfers_inbound"
            referencedColumns: ["id"]
          },
        ]
      }
      grow_transfers_inbound: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          created_by: string | null
          from_license_name: string | null
          from_license_number: string | null
          id: string
          notes: string | null
          org_id: string
          source_type: string | null
          status: string | null
          transfer_id: string
          updated_at: string | null
          wcia_json_data: Json | null
          wcia_json_url: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          created_by?: string | null
          from_license_name?: string | null
          from_license_number?: string | null
          id?: string
          notes?: string | null
          org_id: string
          source_type?: string | null
          status?: string | null
          transfer_id: string
          updated_at?: string | null
          wcia_json_data?: Json | null
          wcia_json_url?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          created_by?: string | null
          from_license_name?: string | null
          from_license_number?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          source_type?: string | null
          status?: string | null
          transfer_id?: string
          updated_at?: string | null
          wcia_json_data?: Json | null
          wcia_json_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grow_transfers_inbound_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      grow_waste_log: {
        Row: {
          area_id: string | null
          grow_cycle_id: string | null
          harvest_id: string | null
          id: string
          notes: string | null
          org_id: string
          plant_id: string | null
          recorded_at: string | null
          recorded_by: string | null
          waste_type: string
          weight_grams: number
        }
        Insert: {
          area_id?: string | null
          grow_cycle_id?: string | null
          harvest_id?: string | null
          id?: string
          notes?: string | null
          org_id: string
          plant_id?: string | null
          recorded_at?: string | null
          recorded_by?: string | null
          waste_type: string
          weight_grams: number
        }
        Update: {
          area_id?: string | null
          grow_cycle_id?: string | null
          harvest_id?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          plant_id?: string | null
          recorded_at?: string | null
          recorded_by?: string | null
          waste_type?: string
          weight_grams?: number
        }
        Relationships: [
          {
            foreignKeyName: "grow_waste_log_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "grow_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_waste_log_grow_cycle_id_fkey"
            columns: ["grow_cycle_id"]
            isOneToOne: false
            referencedRelation: "grow_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_waste_log_harvest_id_fkey"
            columns: ["harvest_id"]
            isOneToOne: false
            referencedRelation: "grow_harvests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_waste_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grow_waste_log_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "grow_plants"
            referencedColumns: ["id"]
          },
        ]
      }
      industry_pulse_items: {
        Row: {
          ai_impact: string | null
          ai_impact_consumers: string | null
          ai_impact_farms: string | null
          ai_impact_retailers: string | null
          ai_outcome: string | null
          ai_summary: string | null
          bill_number: string | null
          category: string | null
          committee: string | null
          created_at: string
          effective_date: string | null
          external_id: string | null
          id: string
          last_action: string | null
          last_action_date: string | null
          org_id: string | null
          published_at: string | null
          raw_content: string | null
          relevance_score: number | null
          scope: string | null
          source_name: string
          source_url: string | null
          sponsors: string[] | null
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          ai_impact?: string | null
          ai_impact_consumers?: string | null
          ai_impact_farms?: string | null
          ai_impact_retailers?: string | null
          ai_outcome?: string | null
          ai_summary?: string | null
          bill_number?: string | null
          category?: string | null
          committee?: string | null
          created_at?: string
          effective_date?: string | null
          external_id?: string | null
          id?: string
          last_action?: string | null
          last_action_date?: string | null
          org_id?: string | null
          published_at?: string | null
          raw_content?: string | null
          relevance_score?: number | null
          scope?: string | null
          source_name: string
          source_url?: string | null
          sponsors?: string[] | null
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          ai_impact?: string | null
          ai_impact_consumers?: string | null
          ai_impact_farms?: string | null
          ai_impact_retailers?: string | null
          ai_outcome?: string | null
          ai_summary?: string | null
          bill_number?: string | null
          category?: string | null
          committee?: string | null
          created_at?: string
          effective_date?: string | null
          external_id?: string | null
          id?: string
          last_action?: string | null
          last_action_date?: string | null
          org_id?: string | null
          published_at?: string | null
          raw_content?: string | null
          relevance_score?: number | null
          scope?: string | null
          source_name?: string
          source_url?: string | null
          sponsors?: string[] | null
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      intel_alerts: {
        Row: {
          action_payload: Json | null
          action_suggestion: string | null
          action_type: string | null
          alert_type: string
          body: string
          brand_id: string | null
          brand_name: string | null
          category_id: string | null
          created_at: string | null
          details: Json | null
          dispensary_id: string | null
          id: string
          intel_store_id: string | null
          is_acted_on: boolean | null
          is_read: boolean | null
          org_id: string | null
          product_name: string | null
          severity: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          action_payload?: Json | null
          action_suggestion?: string | null
          action_type?: string | null
          alert_type: string
          body: string
          brand_id?: string | null
          brand_name?: string | null
          category_id?: string | null
          created_at?: string | null
          details?: Json | null
          dispensary_id?: string | null
          id?: string
          intel_store_id?: string | null
          is_acted_on?: boolean | null
          is_read?: boolean | null
          org_id?: string | null
          product_name?: string | null
          severity?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          action_payload?: Json | null
          action_suggestion?: string | null
          action_type?: string | null
          alert_type?: string
          body?: string
          brand_id?: string | null
          brand_name?: string | null
          category_id?: string | null
          created_at?: string | null
          details?: Json | null
          dispensary_id?: string | null
          id?: string
          intel_store_id?: string | null
          is_acted_on?: boolean | null
          is_read?: boolean | null
          org_id?: string | null
          product_name?: string | null
          severity?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intel_alerts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "market_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intel_alerts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "mv_brand_rankings"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "intel_alerts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "market_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intel_alerts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "mv_category_share"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "intel_alerts_dispensary_id_fkey"
            columns: ["dispensary_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intel_alerts_intel_store_id_fkey"
            columns: ["intel_store_id"]
            isOneToOne: false
            referencedRelation: "intel_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intel_alerts_intel_store_id_fkey"
            columns: ["intel_store_id"]
            isOneToOne: false
            referencedRelation: "v_intel_store_platform_coverage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intel_alerts_intel_store_id_fkey"
            columns: ["intel_store_id"]
            isOneToOne: false
            referencedRelation: "v_store_platform_crossref"
            referencedColumns: ["id"]
          },
        ]
      }
      intel_detected_needs_credentials: {
        Row: {
          detected_at: string | null
          id: string
          iframe_srcs: Json | null
          intel_store_id: string
          platform: string
          scanned_url: string | null
        }
        Insert: {
          detected_at?: string | null
          id?: string
          iframe_srcs?: Json | null
          intel_store_id: string
          platform: string
          scanned_url?: string | null
        }
        Update: {
          detected_at?: string | null
          id?: string
          iframe_srcs?: Json | null
          intel_store_id?: string
          platform?: string
          scanned_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intel_detected_needs_credentials_intel_store_id_fkey"
            columns: ["intel_store_id"]
            isOneToOne: false
            referencedRelation: "intel_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intel_detected_needs_credentials_intel_store_id_fkey"
            columns: ["intel_store_id"]
            isOneToOne: false
            referencedRelation: "v_intel_store_platform_coverage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intel_detected_needs_credentials_intel_store_id_fkey"
            columns: ["intel_store_id"]
            isOneToOne: false
            referencedRelation: "v_store_platform_crossref"
            referencedColumns: ["id"]
          },
        ]
      }
      intel_knowledge_base: {
        Row: {
          content: string
          content_type: string | null
          created_at: string | null
          embedding: string | null
          id: string
          metadata: Json | null
          source: string | null
        }
        Insert: {
          content: string
          content_type?: string | null
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          source?: string | null
        }
        Update: {
          content?: string
          content_type?: string | null
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          source?: string | null
        }
        Relationships: []
      }
      intel_stale_platform_bindings: {
        Row: {
          binding_value: string | null
          id: string
          intel_store_id: string
          last_scanned: string | null
          platform: string
          scanned_url: string | null
        }
        Insert: {
          binding_value?: string | null
          id?: string
          intel_store_id: string
          last_scanned?: string | null
          platform: string
          scanned_url?: string | null
        }
        Update: {
          binding_value?: string | null
          id?: string
          intel_store_id?: string
          last_scanned?: string | null
          platform?: string
          scanned_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intel_stale_platform_bindings_intel_store_id_fkey"
            columns: ["intel_store_id"]
            isOneToOne: false
            referencedRelation: "intel_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intel_stale_platform_bindings_intel_store_id_fkey"
            columns: ["intel_store_id"]
            isOneToOne: false
            referencedRelation: "v_intel_store_platform_coverage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intel_stale_platform_bindings_intel_store_id_fkey"
            columns: ["intel_store_id"]
            isOneToOne: false
            referencedRelation: "v_store_platform_crossref"
            referencedColumns: ["id"]
          },
        ]
      }
      intel_store_platform_scan: {
        Row: {
          detected: Json
          error: string | null
          http_status: number | null
          id: string
          intel_store_id: string
          raw_signals: Json
          scanned_at: string | null
          via: string | null
          website: string | null
        }
        Insert: {
          detected?: Json
          error?: string | null
          http_status?: number | null
          id?: string
          intel_store_id: string
          raw_signals?: Json
          scanned_at?: string | null
          via?: string | null
          website?: string | null
        }
        Update: {
          detected?: Json
          error?: string | null
          http_status?: number | null
          id?: string
          intel_store_id?: string
          raw_signals?: Json
          scanned_at?: string | null
          via?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intel_store_platform_scan_intel_store_id_fkey"
            columns: ["intel_store_id"]
            isOneToOne: false
            referencedRelation: "intel_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intel_store_platform_scan_intel_store_id_fkey"
            columns: ["intel_store_id"]
            isOneToOne: false
            referencedRelation: "v_intel_store_platform_coverage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intel_store_platform_scan_intel_store_id_fkey"
            columns: ["intel_store_id"]
            isOneToOne: false
            referencedRelation: "v_store_platform_crossref"
            referencedColumns: ["id"]
          },
        ]
      }
      intel_stores: {
        Row: {
          address: string | null
          business_name: string | null
          city: string | null
          county: string | null
          created_at: string | null
          crm_contact_id: string | null
          demographic_data: Json | null
          designated_scraper: string | null
          designated_scraper_locked: boolean
          dutchie_dispensary_id: string | null
          dutchie_last_scraped_at: string | null
          dutchie_product_count: number | null
          dutchie_scrape_error: string | null
          dutchie_scrape_status: string | null
          dutchie_slug: string | null
          id: string
          jane_last_scraped_at: string | null
          jane_product_count: number | null
          jane_scrape_error: string | null
          jane_scrape_status: string | null
          jane_store_id: number | null
          latitude: number | null
          lcb_license_id: string | null
          leafly_dispensary_id: string | null
          leafly_last_scraped_at: string | null
          leafly_product_count: number | null
          leafly_scrape_error: string | null
          leafly_scrape_status: string | null
          leafly_slug: string | null
          longitude: number | null
          menu_last_updated: string | null
          name: string
          notes: string | null
          online_ordering_platform: string | null
          org_id: string | null
          phone: string | null
          posabit_feed_key: string | null
          posabit_last_scraped_at: string | null
          posabit_merchant: string | null
          posabit_merchant_token: string | null
          posabit_product_count: number | null
          posabit_scrape_error: string | null
          posabit_scrape_status: string | null
          posabit_venue: string | null
          primary_platform: string | null
          state: string | null
          status: string | null
          total_products: number | null
          trade_name: string | null
          updated_at: string | null
          website: string | null
          weedmaps_last_scraped_at: string | null
          weedmaps_product_count: number | null
          weedmaps_scrape_error: string | null
          weedmaps_scrape_status: string | null
          weedmaps_slug: string | null
          zip: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          business_name?: string | null
          city?: string | null
          county?: string | null
          created_at?: string | null
          crm_contact_id?: string | null
          demographic_data?: Json | null
          designated_scraper?: string | null
          designated_scraper_locked?: boolean
          dutchie_dispensary_id?: string | null
          dutchie_last_scraped_at?: string | null
          dutchie_product_count?: number | null
          dutchie_scrape_error?: string | null
          dutchie_scrape_status?: string | null
          dutchie_slug?: string | null
          id?: string
          jane_last_scraped_at?: string | null
          jane_product_count?: number | null
          jane_scrape_error?: string | null
          jane_scrape_status?: string | null
          jane_store_id?: number | null
          latitude?: number | null
          lcb_license_id?: string | null
          leafly_dispensary_id?: string | null
          leafly_last_scraped_at?: string | null
          leafly_product_count?: number | null
          leafly_scrape_error?: string | null
          leafly_scrape_status?: string | null
          leafly_slug?: string | null
          longitude?: number | null
          menu_last_updated?: string | null
          name: string
          notes?: string | null
          online_ordering_platform?: string | null
          org_id?: string | null
          phone?: string | null
          posabit_feed_key?: string | null
          posabit_last_scraped_at?: string | null
          posabit_merchant?: string | null
          posabit_merchant_token?: string | null
          posabit_product_count?: number | null
          posabit_scrape_error?: string | null
          posabit_scrape_status?: string | null
          posabit_venue?: string | null
          primary_platform?: string | null
          state?: string | null
          status?: string | null
          total_products?: number | null
          trade_name?: string | null
          updated_at?: string | null
          website?: string | null
          weedmaps_last_scraped_at?: string | null
          weedmaps_product_count?: number | null
          weedmaps_scrape_error?: string | null
          weedmaps_scrape_status?: string | null
          weedmaps_slug?: string | null
          zip?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          business_name?: string | null
          city?: string | null
          county?: string | null
          created_at?: string | null
          crm_contact_id?: string | null
          demographic_data?: Json | null
          designated_scraper?: string | null
          designated_scraper_locked?: boolean
          dutchie_dispensary_id?: string | null
          dutchie_last_scraped_at?: string | null
          dutchie_product_count?: number | null
          dutchie_scrape_error?: string | null
          dutchie_scrape_status?: string | null
          dutchie_slug?: string | null
          id?: string
          jane_last_scraped_at?: string | null
          jane_product_count?: number | null
          jane_scrape_error?: string | null
          jane_scrape_status?: string | null
          jane_store_id?: number | null
          latitude?: number | null
          lcb_license_id?: string | null
          leafly_dispensary_id?: string | null
          leafly_last_scraped_at?: string | null
          leafly_product_count?: number | null
          leafly_scrape_error?: string | null
          leafly_scrape_status?: string | null
          leafly_slug?: string | null
          longitude?: number | null
          menu_last_updated?: string | null
          name?: string
          notes?: string | null
          online_ordering_platform?: string | null
          org_id?: string | null
          phone?: string | null
          posabit_feed_key?: string | null
          posabit_last_scraped_at?: string | null
          posabit_merchant?: string | null
          posabit_merchant_token?: string | null
          posabit_product_count?: number | null
          posabit_scrape_error?: string | null
          posabit_scrape_status?: string | null
          posabit_venue?: string | null
          primary_platform?: string | null
          state?: string | null
          status?: string | null
          total_products?: number | null
          trade_name?: string | null
          updated_at?: string | null
          website?: string | null
          weedmaps_last_scraped_at?: string | null
          weedmaps_product_count?: number | null
          weedmaps_scrape_error?: string | null
          weedmaps_scrape_status?: string | null
          weedmaps_slug?: string | null
          zip?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intel_stores_lcb_license_id_fkey"
            columns: ["lcb_license_id"]
            isOneToOne: true
            referencedRelation: "lcb_licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      intel_unmatched_discoveries: {
        Row: {
          address: string | null
          city: string | null
          discovered_at: string | null
          id: string
          latitude: number | null
          license_number: string | null
          longitude: number | null
          matched: boolean | null
          matched_intel_store_id: string | null
          phone: string | null
          platform: string
          platform_id: string | null
          platform_slug: string | null
          state: string | null
          store_name: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          discovered_at?: string | null
          id?: string
          latitude?: number | null
          license_number?: string | null
          longitude?: number | null
          matched?: boolean | null
          matched_intel_store_id?: string | null
          phone?: string | null
          platform: string
          platform_id?: string | null
          platform_slug?: string | null
          state?: string | null
          store_name?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          discovered_at?: string | null
          id?: string
          latitude?: number | null
          license_number?: string | null
          longitude?: number | null
          matched?: boolean | null
          matched_intel_store_id?: string | null
          phone?: string | null
          platform?: string
          platform_id?: string | null
          platform_slug?: string | null
          state?: string | null
          store_name?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intel_unmatched_discoveries_matched_intel_store_id_fkey"
            columns: ["matched_intel_store_id"]
            isOneToOne: false
            referencedRelation: "intel_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intel_unmatched_discoveries_matched_intel_store_id_fkey"
            columns: ["matched_intel_store_id"]
            isOneToOne: false
            referencedRelation: "v_intel_store_platform_coverage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intel_unmatched_discoveries_matched_intel_store_id_fkey"
            columns: ["matched_intel_store_id"]
            isOneToOne: false
            referencedRelation: "v_store_platform_crossref"
            referencedColumns: ["id"]
          },
        ]
      }
      jane_rebrand_review: {
        Row: {
          city: string | null
          created_at: string | null
          decision: string | null
          id: string
          jane_address: string | null
          jane_intel_id: string
          jane_name: string
          jane_store_id: number | null
          old_address: string | null
          old_intel_id: string
          old_name: string
        }
        Insert: {
          city?: string | null
          created_at?: string | null
          decision?: string | null
          id?: string
          jane_address?: string | null
          jane_intel_id: string
          jane_name: string
          jane_store_id?: number | null
          old_address?: string | null
          old_intel_id: string
          old_name: string
        }
        Update: {
          city?: string | null
          created_at?: string | null
          decision?: string | null
          id?: string
          jane_address?: string | null
          jane_intel_id?: string
          jane_name?: string
          jane_store_id?: number | null
          old_address?: string | null
          old_intel_id?: string
          old_name?: string
        }
        Relationships: []
      }
      lcb_licenses: {
        Row: {
          address: string | null
          business_name: string | null
          city: string | null
          contact_id: string | null
          county: string | null
          created_at: string | null
          id: string
          license_number: string | null
          license_type: string | null
          phone: string | null
          privilege_status: string | null
          state: string | null
          trade_name: string | null
          updated_at: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          business_name?: string | null
          city?: string | null
          contact_id?: string | null
          county?: string | null
          created_at?: string | null
          id?: string
          license_number?: string | null
          license_type?: string | null
          phone?: string | null
          privilege_status?: string | null
          state?: string | null
          trade_name?: string | null
          updated_at?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          business_name?: string | null
          city?: string | null
          contact_id?: string | null
          county?: string | null
          created_at?: string | null
          id?: string
          license_number?: string | null
          license_type?: string | null
          phone?: string | null
          privilege_status?: string | null
          state?: string | null
          trade_name?: string | null
          updated_at?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lcb_licenses_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_forms: {
        Row: {
          active: boolean | null
          created_at: string | null
          fields: Json
          id: string
          name: string
          org_id: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          fields?: Json
          id?: string
          name: string
          org_id?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          fields?: Json
          id?: string
          name?: string
          org_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_forms_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      market_brands: {
        Row: {
          aliases: string[] | null
          avg_price_per_gram: number | null
          categories: string[] | null
          created_at: string | null
          estimated_market_share: number | null
          first_seen_at: string | null
          id: string
          is_competitor_brand: boolean | null
          is_own_brand: boolean | null
          last_seen_at: string | null
          name: string
          producer_license: string | null
          store_count: number | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          aliases?: string[] | null
          avg_price_per_gram?: number | null
          categories?: string[] | null
          created_at?: string | null
          estimated_market_share?: number | null
          first_seen_at?: string | null
          id?: string
          is_competitor_brand?: boolean | null
          is_own_brand?: boolean | null
          last_seen_at?: string | null
          name: string
          producer_license?: string | null
          store_count?: number | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          aliases?: string[] | null
          avg_price_per_gram?: number | null
          categories?: string[] | null
          created_at?: string | null
          estimated_market_share?: number | null
          first_seen_at?: string | null
          id?: string
          is_competitor_brand?: boolean | null
          is_own_brand?: boolean | null
          last_seen_at?: string | null
          name?: string
          producer_license?: string | null
          store_count?: number | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      market_categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
          parent_id: string | null
          slug: string | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          parent_id?: string | null
          slug?: string | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "market_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "market_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "mv_category_share"
            referencedColumns: ["category_id"]
          },
        ]
      }
      market_snapshots: {
        Row: {
          avg_price: number | null
          avg_price_per_gram: number | null
          category_id: string | null
          created_at: string | null
          id: string
          max_price: number | null
          median_price: number | null
          min_price: number | null
          new_products_count: number | null
          price_change_pct: number | null
          region: string | null
          removed_products_count: number | null
          snapshot_date: string
          top_brands: Json | null
          total_products_tracked: number | null
        }
        Insert: {
          avg_price?: number | null
          avg_price_per_gram?: number | null
          category_id?: string | null
          created_at?: string | null
          id?: string
          max_price?: number | null
          median_price?: number | null
          min_price?: number | null
          new_products_count?: number | null
          price_change_pct?: number | null
          region?: string | null
          removed_products_count?: number | null
          snapshot_date: string
          top_brands?: Json | null
          total_products_tracked?: number | null
        }
        Update: {
          avg_price?: number | null
          avg_price_per_gram?: number | null
          category_id?: string | null
          created_at?: string | null
          id?: string
          max_price?: number | null
          median_price?: number | null
          min_price?: number | null
          new_products_count?: number | null
          price_change_pct?: number | null
          region?: string | null
          removed_products_count?: number | null
          snapshot_date?: string
          top_brands?: Json | null
          total_products_tracked?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "market_snapshots_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "market_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_snapshots_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "mv_category_share"
            referencedColumns: ["category_id"]
          },
        ]
      }
      marketing_generations: {
        Row: {
          context: string | null
          created_at: string | null
          id: string
          image_url: string | null
          org_id: string | null
          prompt: string
          style: string | null
          user_id: string | null
        }
        Insert: {
          context?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          org_id?: string | null
          prompt: string
          style?: string | null
          user_id?: string | null
        }
        Update: {
          context?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          org_id?: string | null
          prompt?: string
          style?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_generations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_normalizations: {
        Row: {
          confidence: number | null
          id: string
          menu_item_id: string | null
          needs_review: boolean | null
          normalization_notes: string | null
          normalized_at: string | null
          normalized_product_id: string | null
        }
        Insert: {
          confidence?: number | null
          id?: string
          menu_item_id?: string | null
          needs_review?: boolean | null
          normalization_notes?: string | null
          normalized_at?: string | null
          normalized_product_id?: string | null
        }
        Update: {
          confidence?: number | null
          id?: string
          menu_item_id?: string | null
          needs_review?: boolean | null
          normalization_notes?: string | null
          normalized_at?: string | null
          normalized_product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_normalizations_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_normalizations_normalized_product_id_fkey"
            columns: ["normalized_product_id"]
            isOneToOne: false
            referencedRelation: "normalized_products"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          consecutive_days_on_menu: number | null
          created_at: string | null
          dispensary_id: string | null
          dispensary_menu_id: string | null
          first_seen_at: string | null
          id: string
          is_on_menu: boolean | null
          last_seen_at: string | null
          needs_review: boolean | null
          normalization_confidence: number | null
          normalized_brand_id: string | null
          normalized_category_id: string | null
          normalized_cbd_pct: number | null
          normalized_name: string | null
          normalized_price: number | null
          normalized_price_per_gram: number | null
          normalized_thc_pct: number | null
          normalized_weight_g: number | null
          on_sale: boolean | null
          raw_brand: string | null
          raw_category: string | null
          raw_cbd: string | null
          raw_description: string | null
          raw_image_url: string | null
          raw_name: string
          raw_price: number | null
          raw_strain_type: string | null
          raw_thc: string | null
          raw_weight: string | null
          sale_price: number | null
          scraped_at: string | null
          source_url: string | null
        }
        Insert: {
          consecutive_days_on_menu?: number | null
          created_at?: string | null
          dispensary_id?: string | null
          dispensary_menu_id?: string | null
          first_seen_at?: string | null
          id?: string
          is_on_menu?: boolean | null
          last_seen_at?: string | null
          needs_review?: boolean | null
          normalization_confidence?: number | null
          normalized_brand_id?: string | null
          normalized_category_id?: string | null
          normalized_cbd_pct?: number | null
          normalized_name?: string | null
          normalized_price?: number | null
          normalized_price_per_gram?: number | null
          normalized_thc_pct?: number | null
          normalized_weight_g?: number | null
          on_sale?: boolean | null
          raw_brand?: string | null
          raw_category?: string | null
          raw_cbd?: string | null
          raw_description?: string | null
          raw_image_url?: string | null
          raw_name: string
          raw_price?: number | null
          raw_strain_type?: string | null
          raw_thc?: string | null
          raw_weight?: string | null
          sale_price?: number | null
          scraped_at?: string | null
          source_url?: string | null
        }
        Update: {
          consecutive_days_on_menu?: number | null
          created_at?: string | null
          dispensary_id?: string | null
          dispensary_menu_id?: string | null
          first_seen_at?: string | null
          id?: string
          is_on_menu?: boolean | null
          last_seen_at?: string | null
          needs_review?: boolean | null
          normalization_confidence?: number | null
          normalized_brand_id?: string | null
          normalized_category_id?: string | null
          normalized_cbd_pct?: number | null
          normalized_name?: string | null
          normalized_price?: number | null
          normalized_price_per_gram?: number | null
          normalized_thc_pct?: number | null
          normalized_weight_g?: number | null
          on_sale?: boolean | null
          raw_brand?: string | null
          raw_category?: string | null
          raw_cbd?: string | null
          raw_description?: string | null
          raw_image_url?: string | null
          raw_name?: string
          raw_price?: number | null
          raw_strain_type?: string | null
          raw_thc?: string | null
          raw_weight?: string | null
          sale_price?: number | null
          scraped_at?: string | null
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_dispensary_id_fkey"
            columns: ["dispensary_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_dispensary_menu_id_fkey"
            columns: ["dispensary_menu_id"]
            isOneToOne: false
            referencedRelation: "dispensary_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_normalized_brand_id_fkey"
            columns: ["normalized_brand_id"]
            isOneToOne: false
            referencedRelation: "market_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_normalized_brand_id_fkey"
            columns: ["normalized_brand_id"]
            isOneToOne: false
            referencedRelation: "mv_brand_rankings"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "menu_items_normalized_category_id_fkey"
            columns: ["normalized_category_id"]
            isOneToOne: false
            referencedRelation: "market_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_normalized_category_id_fkey"
            columns: ["normalized_category_id"]
            isOneToOne: false
            referencedRelation: "mv_category_share"
            referencedColumns: ["category_id"]
          },
        ]
      }
      menu_snapshots: {
        Row: {
          brand_count: number | null
          contact_id: string | null
          created_at: string | null
          fingerprint: string | null
          id: string
          intel_store_id: string | null
          org_id: string | null
          product_data: Json | null
          snapshot_date: string
          total_products: number | null
        }
        Insert: {
          brand_count?: number | null
          contact_id?: string | null
          created_at?: string | null
          fingerprint?: string | null
          id?: string
          intel_store_id?: string | null
          org_id?: string | null
          product_data?: Json | null
          snapshot_date: string
          total_products?: number | null
        }
        Update: {
          brand_count?: number | null
          contact_id?: string | null
          created_at?: string | null
          fingerprint?: string | null
          id?: string
          intel_store_id?: string | null
          org_id?: string | null
          product_data?: Json | null
          snapshot_date?: string
          total_products?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_snapshots_intel_store_id_fkey"
            columns: ["intel_store_id"]
            isOneToOne: false
            referencedRelation: "intel_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_snapshots_intel_store_id_fkey"
            columns: ["intel_store_id"]
            isOneToOne: false
            referencedRelation: "v_intel_store_platform_coverage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_snapshots_intel_store_id_fkey"
            columns: ["intel_store_id"]
            isOneToOne: false
            referencedRelation: "v_store_platform_crossref"
            referencedColumns: ["id"]
          },
        ]
      }
      normalization_runs: {
        Row: {
          id: string
          items_needing_review: number | null
          items_normalized: number | null
          items_processed: number | null
          run_at: string | null
          run_type: string | null
        }
        Insert: {
          id?: string
          items_needing_review?: number | null
          items_normalized?: number | null
          items_processed?: number | null
          run_at?: string | null
          run_type?: string | null
        }
        Update: {
          id?: string
          items_needing_review?: number | null
          items_normalized?: number | null
          items_processed?: number | null
          run_at?: string | null
          run_type?: string | null
        }
        Relationships: []
      }
      normalization_stats_cache: {
        Row: {
          brand_aliases: number
          category_inferred: number
          id: number
          name_normalized: number
          refreshed_at: string
          total_items: number
          weight_normalized: number
        }
        Insert: {
          brand_aliases?: number
          category_inferred?: number
          id?: number
          name_normalized?: number
          refreshed_at?: string
          total_items?: number
          weight_normalized?: number
        }
        Update: {
          brand_aliases?: number
          category_inferred?: number
          id?: number
          name_normalized?: number
          refreshed_at?: string
          total_items?: number
          weight_normalized?: number
        }
        Relationships: []
      }
      normalized_products: {
        Row: {
          canonical_brand: string | null
          canonical_category: string | null
          canonical_name: string
          canonical_weight: string | null
          cbd_pct: number | null
          created_at: string | null
          id: string
          org_id: string | null
          thc_pct: number | null
          updated_at: string | null
        }
        Insert: {
          canonical_brand?: string | null
          canonical_category?: string | null
          canonical_name: string
          canonical_weight?: string | null
          cbd_pct?: number | null
          created_at?: string | null
          id?: string
          org_id?: string | null
          thc_pct?: number | null
          updated_at?: string | null
        }
        Update: {
          canonical_brand?: string | null
          canonical_category?: string | null
          canonical_name?: string
          canonical_weight?: string | null
          cbd_pct?: number | null
          created_at?: string | null
          id?: string
          org_id?: string | null
          thc_pct?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      notes: {
        Row: {
          ai_summary: string | null
          contact_id: string | null
          content: string
          created_at: string | null
          deal_id: string | null
          id: string
          org_id: string | null
          pinned: boolean | null
          source: string | null
          type: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ai_summary?: string | null
          contact_id?: string | null
          content: string
          created_at?: string | null
          deal_id?: string | null
          id?: string
          org_id?: string | null
          pinned?: boolean | null
          source?: string | null
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ai_summary?: string | null
          contact_id?: string | null
          content?: string
          created_at?: string | null
          deal_id?: string | null
          id?: string
          org_id?: string | null
          pinned?: boolean | null
          source?: string | null
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string | null
          id: string
          link: string | null
          org_id: string | null
          read: boolean | null
          title: string
          type: string | null
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          id?: string
          link?: string | null
          org_id?: string | null
          read?: boolean | null
          title: string
          type?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          id?: string
          link?: string | null
          org_id?: string | null
          read?: boolean | null
          title?: string
          type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          id: string
          invited_by: string | null
          joined_at: string | null
          org_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          org_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          org_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_members_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          crm_plan: string | null
          id: string
          intel_plan: string | null
          logo_url: string | null
          name: string
          plan: string | null
          slug: string
        }
        Insert: {
          created_at?: string | null
          crm_plan?: string | null
          id?: string
          intel_plan?: string | null
          logo_url?: string | null
          name: string
          plan?: string | null
          slug: string
        }
        Update: {
          created_at?: string | null
          crm_plan?: string | null
          id?: string
          intel_plan?: string | null
          logo_url?: string | null
          name?: string
          plan?: string | null
          slug?: string
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          color: string
          created_at: string | null
          id: string
          is_lost: boolean | null
          is_won: boolean | null
          name: string
          org_id: string | null
          pipeline_id: string | null
          probability: number
          sort_order: number
        }
        Insert: {
          color?: string
          created_at?: string | null
          id?: string
          is_lost?: boolean | null
          is_won?: boolean | null
          name: string
          org_id?: string | null
          pipeline_id?: string | null
          probability?: number
          sort_order?: number
        }
        Update: {
          color?: string
          created_at?: string | null
          id?: string
          is_lost?: boolean | null
          is_won?: boolean | null
          name?: string
          org_id?: string | null
          pipeline_id?: string | null
          probability?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          org_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          org_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          org_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_sections: {
        Row: {
          content: string
          created_at: string | null
          id: string
          org_id: string | null
          playbook_id: string | null
          sort_order: number
          title: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          org_id?: string | null
          playbook_id?: string | null
          sort_order?: number
          title: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          org_id?: string | null
          playbook_id?: string | null
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "playbook_sections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_sections_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "playbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      playbooks: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          org_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          org_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          org_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "playbooks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      price_history: {
        Row: {
          created_at: string | null
          dispensary_id: string | null
          id: string
          menu_item_id: string | null
          price: number
          recorded_at: string
          sale_price: number | null
          was_on_sale: boolean | null
        }
        Insert: {
          created_at?: string | null
          dispensary_id?: string | null
          id?: string
          menu_item_id?: string | null
          price: number
          recorded_at?: string
          sale_price?: number | null
          was_on_sale?: boolean | null
        }
        Update: {
          created_at?: string | null
          dispensary_id?: string | null
          id?: string
          menu_item_id?: string | null
          price?: number
          recorded_at?: string
          sale_price?: number | null
          was_on_sale?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "price_history_dispensary_id_fkey"
            columns: ["dispensary_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      product_matches: {
        Row: {
          confidence: number | null
          created_at: string | null
          id: string
          intel_store_id: string | null
          match_method: string | null
          menu_item_id: string | null
          user_product_id: string | null
          verified: boolean | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          id?: string
          intel_store_id?: string | null
          match_method?: string | null
          menu_item_id?: string | null
          user_product_id?: string | null
          verified?: boolean | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          id?: string
          intel_store_id?: string | null
          match_method?: string | null
          menu_item_id?: string | null
          user_product_id?: string | null
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "product_matches_intel_store_id_fkey"
            columns: ["intel_store_id"]
            isOneToOne: false
            referencedRelation: "intel_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_matches_intel_store_id_fkey"
            columns: ["intel_store_id"]
            isOneToOne: false
            referencedRelation: "v_intel_store_platform_coverage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_matches_intel_store_id_fkey"
            columns: ["intel_store_id"]
            isOneToOne: false
            referencedRelation: "v_store_platform_crossref"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_matches_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      product_subscriptions: {
        Row: {
          created_at: string | null
          id: string
          org_id: string
          product: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_ends_at: string | null
          subscription_started_at: string | null
          tier: string
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          org_id: string
          product: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_ends_at?: string | null
          subscription_started_at?: string | null
          tier?: string
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          org_id?: string
          product?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_ends_at?: string | null
          subscription_started_at?: string | null
          tier?: string
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          available: boolean | null
          created_at: string | null
          description: string | null
          farm: string
          harvest_date: string | null
          id: string
          last_updated: string | null
          name: string
          org_id: string | null
          package_date: string | null
          price_per_unit: number | null
          product_image_url: string | null
          source: string | null
          strain: string | null
          thc_percentage: number | null
          type: string | null
          unit: string | null
        }
        Insert: {
          available?: boolean | null
          created_at?: string | null
          description?: string | null
          farm: string
          harvest_date?: string | null
          id?: string
          last_updated?: string | null
          name: string
          org_id?: string | null
          package_date?: string | null
          price_per_unit?: number | null
          product_image_url?: string | null
          source?: string | null
          strain?: string | null
          thc_percentage?: number | null
          type?: string | null
          unit?: string | null
        }
        Update: {
          available?: boolean | null
          created_at?: string | null
          description?: string | null
          farm?: string
          harvest_date?: string | null
          id?: string
          last_updated?: string | null
          name?: string
          org_id?: string | null
          package_date?: string | null
          price_per_unit?: number | null
          product_image_url?: string | null
          source?: string | null
          strain?: string | null
          thc_percentage?: number | null
          type?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          booking_username: string | null
          company: string | null
          dashboard_layout: Json | null
          first_name: string | null
          full_name: string | null
          id: string
          last_name: string | null
          onboarding_complete: boolean | null
          org_id: string | null
          phone: string | null
          role: string | null
          status: string | null
          team_goals: Json | null
          theme_preference: string | null
          tier: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          booking_username?: string | null
          company?: string | null
          dashboard_layout?: Json | null
          first_name?: string | null
          full_name?: string | null
          id: string
          last_name?: string | null
          onboarding_complete?: boolean | null
          org_id?: string | null
          phone?: string | null
          role?: string | null
          status?: string | null
          team_goals?: Json | null
          theme_preference?: string | null
          tier?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          booking_username?: string | null
          company?: string | null
          dashboard_layout?: Json | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          onboarding_complete?: boolean | null
          org_id?: string | null
          phone?: string | null
          role?: string | null
          status?: string | null
          team_goals?: Json | null
          theme_preference?: string | null
          tier?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_templates: {
        Row: {
          created_at: string | null
          default_products: Json | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          sections: Json
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          default_products?: Json | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sections: Json
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          default_products?: Json | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sections?: Json
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      proposals: {
        Row: {
          contact_id: string | null
          created_at: string | null
          deal_id: string | null
          discount_amount: number | null
          discount_percent: number | null
          id: string
          notes: string | null
          org_id: string | null
          pdf_url: string | null
          products: Json | null
          sections: Json
          sent_at: string | null
          sent_via: string | null
          status: string | null
          subtotal: number | null
          template_id: string | null
          title: string
          total: number | null
          tracking_id: string | null
          type: string
          updated_at: string | null
          user_id: string | null
          valid_until: string | null
          view_count: number | null
          viewed_at: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          notes?: string | null
          org_id?: string | null
          pdf_url?: string | null
          products?: Json | null
          sections: Json
          sent_at?: string | null
          sent_via?: string | null
          status?: string | null
          subtotal?: number | null
          template_id?: string | null
          title: string
          total?: number | null
          tracking_id?: string | null
          type: string
          updated_at?: string | null
          user_id?: string | null
          valid_until?: string | null
          view_count?: number | null
          viewed_at?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          notes?: string | null
          org_id?: string | null
          pdf_url?: string | null
          products?: Json | null
          sections?: Json
          sent_at?: string | null
          sent_via?: string | null
          status?: string | null
          subtotal?: number | null
          template_id?: string | null
          title?: string
          total?: number | null
          tracking_id?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string | null
          valid_until?: string | null
          view_count?: number | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "proposal_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      route_plans: {
        Row: {
          ai_notes: string | null
          calendar_event_id: string | null
          created_at: string | null
          date: string
          destination: string | null
          destination_lat: number | null
          destination_lng: number | null
          id: string
          origin: string | null
          origin_lat: number | null
          origin_lng: number | null
          recommended_stops: Json | null
          status: string | null
          total_drive_minutes: number | null
          total_stops: number | null
        }
        Insert: {
          ai_notes?: string | null
          calendar_event_id?: string | null
          created_at?: string | null
          date: string
          destination?: string | null
          destination_lat?: number | null
          destination_lng?: number | null
          id?: string
          origin?: string | null
          origin_lat?: number | null
          origin_lng?: number | null
          recommended_stops?: Json | null
          status?: string | null
          total_drive_minutes?: number | null
          total_stops?: number | null
        }
        Update: {
          ai_notes?: string | null
          calendar_event_id?: string | null
          created_at?: string | null
          date?: string
          destination?: string | null
          destination_lat?: number | null
          destination_lng?: number | null
          id?: string
          origin?: string | null
          origin_lat?: number | null
          origin_lng?: number | null
          recommended_stops?: Json | null
          status?: string | null
          total_drive_minutes?: number | null
          total_stops?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "route_plans_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      samples: {
        Row: {
          contact_id: string | null
          created_at: string | null
          date_given: string
          feedback_notes: string | null
          feedback_status: string | null
          follow_up_task_id: string | null
          given_to: string | null
          id: string
          org_id: string | null
          product_id: string | null
          quantity: number | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          date_given?: string
          feedback_notes?: string | null
          feedback_status?: string | null
          follow_up_task_id?: string | null
          given_to?: string | null
          id?: string
          org_id?: string | null
          product_id?: string | null
          quantity?: number | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          date_given?: string
          feedback_notes?: string | null
          feedback_status?: string | null
          follow_up_task_id?: string | null
          given_to?: string | null
          id?: string
          org_id?: string | null
          product_id?: string | null
          quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "samples_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "samples_follow_up_task_id_fkey"
            columns: ["follow_up_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "samples_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "samples_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_routes: {
        Row: {
          created_at: string | null
          date: string | null
          destination: string | null
          id: string
          name: string
          org_id: string | null
          origin: string | null
          stops: Json
          total_distance: string | null
          total_time: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          date?: string | null
          destination?: string | null
          id?: string
          name: string
          org_id?: string | null
          origin?: string | null
          stops?: Json
          total_distance?: string | null
          total_time?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string | null
          destination?: string | null
          id?: string
          name?: string
          org_id?: string | null
          origin?: string | null
          stops?: Json
          total_distance?: string | null
          total_time?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_routes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scrape_jobs: {
        Row: {
          apify_run_id: string | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          items_found: number | null
          items_normalized: number | null
          items_processed: number | null
          region: string | null
          source: string
          started_at: string | null
          status: string | null
        }
        Insert: {
          apify_run_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          items_found?: number | null
          items_normalized?: number | null
          items_processed?: number | null
          region?: string | null
          source: string
          started_at?: string | null
          status?: string | null
        }
        Update: {
          apify_run_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          items_found?: number | null
          items_normalized?: number | null
          items_processed?: number | null
          region?: string | null
          source?: string
          started_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      scrape_schedules: {
        Row: {
          created_at: string
          enabled: boolean
          frequency: string
          id: string
          last_run_at: string | null
          next_run_at: string | null
          org_id: string
          platforms: string[]
          run_hour: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          frequency?: string
          id?: string
          last_run_at?: string | null
          next_run_at?: string | null
          org_id: string
          platforms?: string[]
          run_hour?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          frequency?: string
          id?: string
          last_run_at?: string | null
          next_run_at?: string | null
          org_id?: string
          platforms?: string[]
          run_hour?: number
          updated_at?: string
        }
        Relationships: []
      }
      segments: {
        Row: {
          created_at: string | null
          id: string
          name: string
          org_id: string | null
          rules: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          org_id?: string | null
          rules?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          org_id?: string | null
          rules?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "segments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sequence_steps: {
        Row: {
          body: string
          condition_config: Json | null
          condition_type: string | null
          created_at: string | null
          delay_days: number
          id: string
          org_id: string | null
          step_number: number
          subject: string
          template_id: string | null
        }
        Insert: {
          body: string
          condition_config?: Json | null
          condition_type?: string | null
          created_at?: string | null
          delay_days?: number
          id?: string
          org_id?: string | null
          step_number: number
          subject: string
          template_id?: string | null
        }
        Update: {
          body?: string
          condition_config?: Json | null
          condition_type?: string | null
          created_at?: string | null
          delay_days?: number
          id?: string
          org_id?: string | null
          step_number?: number
          subject?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sequence_steps_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "sequence_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      sequence_templates: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          org_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          org_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          org_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sequence_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      slack_tokens: {
        Row: {
          access_token: string
          bot_token: string | null
          created_at: string | null
          id: string
          incoming_webhook_url: string | null
          org_id: string | null
          team_id: string
          team_name: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          bot_token?: string | null
          created_at?: string | null
          id?: string
          incoming_webhook_url?: string | null
          org_id?: string | null
          team_id: string
          team_name?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          bot_token?: string | null
          created_at?: string | null
          id?: string
          incoming_webhook_url?: string | null
          org_id?: string | null
          team_id?: string
          team_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      store_deals: {
        Row: {
          brand_name: string | null
          deal_description: string | null
          deal_price: number | null
          deal_type: string | null
          discount_pct: number | null
          id: string
          intel_store_id: string | null
          original_price: number | null
          product_name: string | null
          scraped_at: string | null
          source: string | null
          valid_until: string | null
        }
        Insert: {
          brand_name?: string | null
          deal_description?: string | null
          deal_price?: number | null
          deal_type?: string | null
          discount_pct?: number | null
          id?: string
          intel_store_id?: string | null
          original_price?: number | null
          product_name?: string | null
          scraped_at?: string | null
          source?: string | null
          valid_until?: string | null
        }
        Update: {
          brand_name?: string | null
          deal_description?: string | null
          deal_price?: number | null
          deal_type?: string | null
          discount_pct?: number | null
          id?: string
          intel_store_id?: string | null
          original_price?: number | null
          product_name?: string | null
          scraped_at?: string | null
          source?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_deals_intel_store_id_fkey"
            columns: ["intel_store_id"]
            isOneToOne: false
            referencedRelation: "intel_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_deals_intel_store_id_fkey"
            columns: ["intel_store_id"]
            isOneToOne: false
            referencedRelation: "v_intel_store_platform_coverage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_deals_intel_store_id_fkey"
            columns: ["intel_store_id"]
            isOneToOne: false
            referencedRelation: "v_store_platform_crossref"
            referencedColumns: ["id"]
          },
        ]
      }
      store_tags: {
        Row: {
          created_at: string | null
          id: string
          intel_store_id: string
          org_id: string | null
          tag: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          intel_store_id: string
          org_id?: string | null
          tag: string
        }
        Update: {
          created_at?: string | null
          id?: string
          intel_store_id?: string
          org_id?: string | null
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_tags_intel_store_id_fkey"
            columns: ["intel_store_id"]
            isOneToOne: false
            referencedRelation: "intel_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_tags_intel_store_id_fkey"
            columns: ["intel_store_id"]
            isOneToOne: false
            referencedRelation: "v_intel_store_platform_coverage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_tags_intel_store_id_fkey"
            columns: ["intel_store_id"]
            isOneToOne: false
            referencedRelation: "v_store_platform_crossref"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          contact_id: string | null
          created_at: string | null
          deal_id: string | null
          description: string | null
          due_date: string | null
          id: string
          org_id: string | null
          priority: string | null
          status: string | null
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          org_id?: string | null
          priority?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          org_id?: string | null
          priority?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_messages: {
        Row: {
          channel: string
          content: string
          created_at: string | null
          deleted: boolean | null
          edited_at: string | null
          file_name: string | null
          file_type: string | null
          file_url: string | null
          id: string
          is_ai: boolean | null
          mentions: string[] | null
          org_id: string | null
          pinned: boolean | null
          reactions: Json | null
          recipient_id: string | null
          slack_ts: string | null
          source: string | null
          thread_parent_id: string | null
          user_id: string | null
        }
        Insert: {
          channel?: string
          content: string
          created_at?: string | null
          deleted?: boolean | null
          edited_at?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_ai?: boolean | null
          mentions?: string[] | null
          org_id?: string | null
          pinned?: boolean | null
          reactions?: Json | null
          recipient_id?: string | null
          slack_ts?: string | null
          source?: string | null
          thread_parent_id?: string | null
          user_id?: string | null
        }
        Update: {
          channel?: string
          content?: string
          created_at?: string | null
          deleted?: boolean | null
          edited_at?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_ai?: boolean | null
          mentions?: string[] | null
          org_id?: string | null
          pinned?: boolean | null
          reactions?: Json | null
          recipient_id?: string | null
          slack_ts?: string | null
          source?: string | null
          thread_parent_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_messages_thread_parent_id_fkey"
            columns: ["thread_parent_id"]
            isOneToOne: false
            referencedRelation: "team_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_messages_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      territories: {
        Row: {
          assigned_to: string | null
          cities: string[]
          color: string
          created_at: string | null
          id: string
          name: string
          org_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          cities?: string[]
          color?: string
          created_at?: string | null
          id?: string
          name: string
          org_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          cities?: string[]
          color?: string
          created_at?: string | null
          id?: string
          name?: string
          org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "territories_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_alert_rules: {
        Row: {
          brand_name: string | null
          city: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          org_id: string | null
          rule_type: string
          severity: string | null
          threshold_price: number | null
          user_id: string | null
        }
        Insert: {
          brand_name?: string | null
          city?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          org_id?: string | null
          rule_type: string
          severity?: string | null
          threshold_price?: number | null
          user_id?: string | null
        }
        Update: {
          brand_name?: string | null
          city?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          org_id?: string | null
          rule_type?: string
          severity?: string | null
          threshold_price?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_brands: {
        Row: {
          brand_name: string
          created_at: string | null
          id: string
          is_own_brand: boolean | null
          org_id: string
        }
        Insert: {
          brand_name: string
          created_at?: string | null
          id?: string
          is_own_brand?: boolean | null
          org_id: string
        }
        Update: {
          brand_name?: string
          created_at?: string | null
          id?: string
          is_own_brand?: boolean | null
          org_id?: string
        }
        Relationships: []
      }
      user_files: {
        Row: {
          created_at: string | null
          file_size: number | null
          file_type: string | null
          filename: string
          folder_id: string | null
          id: string
          org_id: string | null
          public_url: string | null
          storage_path: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          file_size?: number | null
          file_type?: string | null
          filename: string
          folder_id?: string | null
          id?: string
          org_id?: string | null
          public_url?: string | null
          storage_path: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          file_size?: number | null
          file_type?: string | null
          filename?: string
          folder_id?: string | null
          id?: string
          org_id?: string | null
          public_url?: string | null
          storage_path?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_files_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "user_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_files_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_folders: {
        Row: {
          created_at: string | null
          id: string
          name: string
          org_id: string | null
          parent_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          org_id?: string | null
          parent_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          org_id?: string | null
          parent_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_folders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "user_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_products: {
        Row: {
          active: boolean | null
          aliases: string[] | null
          brand_id: string | null
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          org_id: string
          product_name: string
          thc_range: string | null
          unit_price: number | null
          weight: string | null
        }
        Insert: {
          active?: boolean | null
          aliases?: string[] | null
          brand_id?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          org_id: string
          product_name: string
          thc_range?: string | null
          unit_price?: number | null
          weight?: string | null
        }
        Update: {
          active?: boolean | null
          aliases?: string[] | null
          brand_id?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          org_id?: string
          product_name?: string
          thc_range?: string | null
          unit_price?: number | null
          weight?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "user_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_days: {
        Row: {
          contact_id: string | null
          created_at: string | null
          date: string
          follow_up_orders: number | null
          id: string
          location: string | null
          notes: string | null
          on_site_sales: number | null
          org_id: string | null
          products_displayed: string[] | null
          total_revenue: number | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          date: string
          follow_up_orders?: number | null
          id?: string
          location?: string | null
          notes?: string | null
          on_site_sales?: number | null
          org_id?: string | null
          products_displayed?: string[] | null
          total_revenue?: number | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          date?: string
          follow_up_orders?: number | null
          id?: string
          location?: string | null
          notes?: string | null
          on_site_sales?: number | null
          org_id?: string | null
          products_displayed?: string[] | null
          total_revenue?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_days_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_days_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_briefings: {
        Row: {
          generated_at: string | null
          id: string
          model_used: string | null
          narrative: string | null
          org_id: string | null
          stats: Json | null
          week_start: string
        }
        Insert: {
          generated_at?: string | null
          id?: string
          model_used?: string | null
          narrative?: string | null
          org_id?: string | null
          stats?: Json | null
          week_start: string
        }
        Update: {
          generated_at?: string | null
          id?: string
          model_used?: string | null
          narrative?: string | null
          org_id?: string | null
          stats?: Json | null
          week_start?: string
        }
        Relationships: []
      }
      workflows: {
        Row: {
          action_config: Json
          action_type: string
          active: boolean
          created_at: string | null
          id: string
          name: string
          org_id: string | null
          trigger_config: Json
          trigger_type: string
          user_id: string | null
        }
        Insert: {
          action_config?: Json
          action_type: string
          active?: boolean
          created_at?: string | null
          id?: string
          name: string
          org_id?: string | null
          trigger_config?: Json
          trigger_type: string
          user_id?: string | null
        }
        Update: {
          action_config?: Json
          action_type?: string
          active?: boolean
          created_at?: string | null
          id?: string
          name?: string
          org_id?: string | null
          trigger_config?: Json
          trigger_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflows_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      mv_brand_rankings: {
        Row: {
          avg_price: number | null
          brand_id: string | null
          brand_name: string | null
          product_count: number | null
          store_count: number | null
        }
        Relationships: []
      }
      mv_category_share: {
        Row: {
          avg_price: number | null
          category_id: string | null
          category_name: string | null
          product_count: number | null
        }
        Relationships: []
      }
      v_intel_store_platform_coverage: {
        Row: {
          city: string | null
          id: string | null
          name: string | null
          on_dutchie: boolean | null
          on_jane: boolean | null
          on_leafly: boolean | null
          on_posabit: boolean | null
          on_weedmaps: boolean | null
          platform_count: number | null
          status: string | null
        }
        Insert: {
          city?: string | null
          id?: string | null
          name?: string | null
          on_dutchie?: never
          on_jane?: never
          on_leafly?: never
          on_posabit?: never
          on_weedmaps?: never
          platform_count?: never
          status?: string | null
        }
        Update: {
          city?: string | null
          id?: string | null
          name?: string | null
          on_dutchie?: never
          on_jane?: never
          on_leafly?: never
          on_posabit?: never
          on_weedmaps?: never
          platform_count?: never
          status?: string | null
        }
        Relationships: []
      }
      v_platform_scan_summary: {
        Row: {
          city: string | null
          db_current: string | null
          db_dutchie: boolean | null
          db_jane: boolean | null
          db_leafly: boolean | null
          db_posabit: boolean | null
          db_weedmaps: boolean | null
          det_dutchie: boolean | null
          det_jane: boolean | null
          det_leafly: boolean | null
          det_posabit: boolean | null
          det_weedmaps: boolean | null
          error: string | null
          http_status: number | null
          intel_store_id: string | null
          name: string | null
          via: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intel_store_platform_scan_intel_store_id_fkey"
            columns: ["intel_store_id"]
            isOneToOne: false
            referencedRelation: "intel_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intel_store_platform_scan_intel_store_id_fkey"
            columns: ["intel_store_id"]
            isOneToOne: false
            referencedRelation: "v_intel_store_platform_coverage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intel_store_platform_scan_intel_store_id_fkey"
            columns: ["intel_store_id"]
            isOneToOne: false
            referencedRelation: "v_store_platform_crossref"
            referencedColumns: ["id"]
          },
        ]
      }
      v_store_platform_crossref: {
        Row: {
          alignment: string | null
          city: string | null
          designated_scraper: string | null
          id: string | null
          menu_items_by_platform: Json | null
          menu_last_scraped: string | null
          name: string | null
          primary_platform: string | null
          website_platform: string | null
          website_signal: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      canon_category: { Args: { txt: string }; Returns: string }
      daitch_mokotoff: { Args: { "": string }; Returns: string[] }
      dmetaphone: { Args: { "": string }; Returns: string }
      dmetaphone_alt: { Args: { "": string }; Returns: string }
      find_lcb_matches: {
        Args: never
        Returns: {
          existing_company: string
          existing_id: string
          lcb_company: string
          lcb_id: string
          match_city: string
          similarity: number
        }[]
      }
      get_brand_rankings: {
        Args: never
        Returns: {
          avg_price: number
          brand_name: string
          product_count: number
          store_count: number
        }[]
      }
      get_brand_store_count: { Args: { brand_name: string }; Returns: number }
      get_category_share: {
        Args: never
        Returns: {
          avg_price: number
          category_name: string
          product_count: number
        }[]
      }
      get_coverage_audit: { Args: never; Returns: Json }
      get_own_brand_stores: {
        Args: { p_org_id: string }
        Returns: {
          intel_store_id: string
        }[]
      }
      get_user_org_id: { Args: never; Returns: string }
      match_products: {
        Args: { p_org_id: string }
        Returns: {
          auto_verified: number
          matched_count: number
          total_products: number
        }[]
      }
      normalization_stats: {
        Args: never
        Returns: {
          brand_aliases: number
          category_inferred: number
          name_normalized: number
          total_items: number
          weight_normalized: number
        }[]
      }
      normalize_company: { Args: { name: string }; Returns: string }
      parse_weight_g: { Args: { txt: string }; Returns: number }
      refresh_materialized_views: { Args: never; Returns: undefined }
      refresh_normalization_stats: { Args: never; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      soundex: { Args: { "": string }; Returns: string }
      text_soundex: { Args: { "": string }; Returns: string }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
