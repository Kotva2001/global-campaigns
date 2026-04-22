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
      alert_rules: {
        Row: {
          applies_to: string | null
          condition: string
          created_at: string | null
          id: string
          is_active: boolean | null
          metric: string
          name: string
          threshold: number
        }
        Insert: {
          applies_to?: string | null
          condition: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          metric: string
          name: string
          threshold: number
        }
        Update: {
          applies_to?: string | null
          condition?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          metric?: string
          name?: string
          threshold?: number
        }
        Relationships: []
      }
      alerts: {
        Row: {
          actual_value: number | null
          alert_type: string
          campaign_id: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string | null
          threshold_value: number | null
          title: string
        }
        Insert: {
          actual_value?: number | null
          alert_type: string
          campaign_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          threshold_value?: number | null
          title: string
        }
        Update: {
          actual_value?: number | null
          alert_type?: string
          campaign_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          threshold_value?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          brand_mention_type: string | null
          campaign_cost: number | null
          campaign_name: string | null
          collaboration_type: string | null
          comments: number | null
          conversion_rate: number | null
          created_at: string | null
          detected_automatically: boolean | null
          detection_source: string | null
          engagement_rate: number | null
          id: string
          influencer_id: string | null
          last_stats_update: string | null
          likes: number | null
          managed_by: string | null
          platform: string
          publish_date: string | null
          purchase_revenue: number | null
          sessions: number | null
          updated_at: string | null
          utm_link: string | null
          video_id: string | null
          video_url: string | null
          views: number | null
        }
        Insert: {
          brand_mention_type?: string | null
          campaign_cost?: number | null
          campaign_name?: string | null
          collaboration_type?: string | null
          comments?: number | null
          conversion_rate?: number | null
          created_at?: string | null
          detected_automatically?: boolean | null
          detection_source?: string | null
          engagement_rate?: number | null
          id?: string
          influencer_id?: string | null
          last_stats_update?: string | null
          likes?: number | null
          managed_by?: string | null
          platform: string
          publish_date?: string | null
          purchase_revenue?: number | null
          sessions?: number | null
          updated_at?: string | null
          utm_link?: string | null
          video_id?: string | null
          video_url?: string | null
          views?: number | null
        }
        Update: {
          brand_mention_type?: string | null
          campaign_cost?: number | null
          campaign_name?: string | null
          collaboration_type?: string | null
          comments?: number | null
          conversion_rate?: number | null
          created_at?: string | null
          detected_automatically?: boolean | null
          detection_source?: string | null
          engagement_rate?: number | null
          id?: string
          influencer_id?: string | null
          last_stats_update?: string | null
          likes?: number | null
          managed_by?: string | null
          platform?: string
          publish_date?: string | null
          purchase_revenue?: number | null
          sessions?: number | null
          updated_at?: string | null
          utm_link?: string | null
          video_id?: string | null
          video_url?: string | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
        ]
      }
      detected_videos: {
        Row: {
          channel_id: string | null
          channel_name: string | null
          comments: number | null
          created_at: string | null
          id: string
          influencer_id: string | null
          likes: number | null
          mention_locations: string[] | null
          platform: string
          published_at: string | null
          status: string | null
          thumbnail_url: string | null
          video_id: string
          video_title: string | null
          video_url: string
          views: number | null
        }
        Insert: {
          channel_id?: string | null
          channel_name?: string | null
          comments?: number | null
          created_at?: string | null
          id?: string
          influencer_id?: string | null
          likes?: number | null
          mention_locations?: string[] | null
          platform: string
          published_at?: string | null
          status?: string | null
          thumbnail_url?: string | null
          video_id: string
          video_title?: string | null
          video_url: string
          views?: number | null
        }
        Update: {
          channel_id?: string | null
          channel_name?: string | null
          comments?: number | null
          created_at?: string | null
          id?: string
          influencer_id?: string | null
          likes?: number | null
          mention_locations?: string[] | null
          platform?: string
          published_at?: string | null
          status?: string | null
          thumbnail_url?: string | null
          video_id?: string
          video_title?: string | null
          video_url?: string
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "detected_videos_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
        ]
      }
      influencers: {
        Row: {
          contact_email: string | null
          contact_person: string | null
          country: string
          created_at: string | null
          id: string
          instagram_handle: string | null
          name: string
          notes: string | null
          platforms: string[] | null
          status: string | null
          updated_at: string | null
          youtube_channel_id: string | null
          youtube_channel_url: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_person?: string | null
          country: string
          created_at?: string | null
          id?: string
          instagram_handle?: string | null
          name: string
          notes?: string | null
          platforms?: string[] | null
          status?: string | null
          updated_at?: string | null
          youtube_channel_id?: string | null
          youtube_channel_url?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_person?: string | null
          country?: string
          created_at?: string | null
          id?: string
          instagram_handle?: string | null
          name?: string
          notes?: string | null
          platforms?: string[] | null
          status?: string | null
          updated_at?: string | null
          youtube_channel_id?: string | null
          youtube_channel_url?: string | null
        }
        Relationships: []
      }
      scan_log: {
        Row: {
          completed_at: string | null
          error_message: string | null
          id: string
          scan_type: string
          started_at: string | null
          stats_updated: number | null
          status: string
          videos_found: number | null
          videos_new: number | null
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          scan_type: string
          started_at?: string | null
          stats_updated?: number | null
          status: string
          videos_found?: number | null
          videos_new?: number | null
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          scan_type?: string
          started_at?: string | null
          stats_updated?: number | null
          status?: string
          videos_found?: number | null
          videos_new?: number | null
        }
        Relationships: []
      }
      scan_settings: {
        Row: {
          auto_add_known_influencers: boolean | null
          brand_keywords: string[] | null
          id: string
          platforms_to_scan: string[] | null
          scan_frequency_minutes: number | null
          stats_refresh_frequency_minutes: number | null
          updated_at: string | null
          youtube_api_key: string | null
        }
        Insert: {
          auto_add_known_influencers?: boolean | null
          brand_keywords?: string[] | null
          id?: string
          platforms_to_scan?: string[] | null
          scan_frequency_minutes?: number | null
          stats_refresh_frequency_minutes?: number | null
          updated_at?: string | null
          youtube_api_key?: string | null
        }
        Update: {
          auto_add_known_influencers?: boolean | null
          brand_keywords?: string[] | null
          id?: string
          platforms_to_scan?: string[] | null
          scan_frequency_minutes?: number | null
          stats_refresh_frequency_minutes?: number | null
          updated_at?: string | null
          youtube_api_key?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      remove_duplicate_import_data: {
        Args: never
        Returns: {
          merged_influencers: number
          removed_campaigns: number
        }[]
      }
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
