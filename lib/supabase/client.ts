import { createBrowserClient } from '@supabase/ssr';

// Check if Supabase is configured
export const isSupabaseConfigured = () => {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
};

export function createClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Type definitions for database tables
export type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          email: string;
          company_name: string | null;
          company_domain: string | null;
          job_title: string | null;
          job_function: string | null;
          company_type: string | null;
          tier: 'free' | 'pro';
          attribution_source: string | null;
          attribution_campaign: string | null;
          consent_analytics: boolean;
          consent_marketing: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_profiles']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['user_profiles']['Insert']>;
      };
      sessions: {
        Row: {
          id: string;
          user_id: string | null;
          anonymous_id: string | null;
          started_at: string;
          ended_at: string | null;
          duration_seconds: number | null;
          calculation_count: number;
          paywall_hits: number;
          device_type: 'desktop' | 'tablet' | 'mobile' | null;
          referrer_url: string | null;
          utm_source: string | null;
          utm_medium: string | null;
          utm_campaign: string | null;
        };
        Insert: Omit<Database['public']['Tables']['sessions']['Row'], 'id' | 'started_at' | 'calculation_count' | 'paywall_hits'> & {
          id?: string;
          started_at?: string;
          calculation_count?: number;
          paywall_hits?: number;
        };
        Update: Partial<Database['public']['Tables']['sessions']['Insert']>;
      };
      events: {
        Row: {
          id: string;
          user_id: string | null;
          session_id: string | null;
          anonymous_id: string | null;
          event_type: string;
          event_data: Record<string, unknown>;
          user_tier: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['events']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['events']['Insert']>;
      };
      calculations: {
        Row: {
          id: string;
          user_id: string | null;
          session_id: string | null;
          anonymous_id: string | null;
          modality: string;
          development_phase: string;
          indication_category: string | null;
          indication_specific: string | null;
          territory_scope: string | null;
          territories_included: string[] | null;
          exclusivity_type: string | null;
          deal_type: string | null;
          includes_manufacturing: boolean;
          includes_codev: boolean;
          includes_copromote: boolean;
          output_upfront_low: number | null;
          output_upfront_mid: number | null;
          output_upfront_high: number | null;
          output_milestones_total: number | null;
          output_royalty_low: number | null;
          output_royalty_high: number | null;
          output_total_deal_value_low: number | null;
          output_total_deal_value_high: number | null;
          calculation_version: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['calculations']['Row'], 'id' | 'created_at' | 'calculation_version'> & {
          id?: string;
          created_at?: string;
          calculation_version?: string;
        };
        Update: Partial<Database['public']['Tables']['calculations']['Insert']>;
      };
      lead_scores: {
        Row: {
          user_id: string;
          total_sessions: number;
          total_calculations: number;
          sessions_last_7_days: number;
          sessions_last_30_days: number;
          calculations_last_7_days: number;
          calculations_last_30_days: number;
          paywall_hits_total: number;
          export_attempts: number;
          pro_feature_clicks: number;
          unique_modalities_explored: number;
          unique_indications_explored: number;
          avg_session_duration_seconds: number | null;
          lead_score: number;
          lead_tier: 'cold' | 'warm' | 'hot' | 'qualified' | null;
          first_activity_at: string | null;
          last_activity_at: string | null;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['lead_scores']['Row']> & {
          user_id: string;
        };
        Update: Partial<Database['public']['Tables']['lead_scores']['Insert']>;
      };
    };
  };
};
