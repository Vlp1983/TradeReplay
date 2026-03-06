export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          avatar_url: string | null
          stripe_customer_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          stripe_customer_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          status: string
          price_id: string
          plan: string
          current_period_start: string | null
          current_period_end: string | null
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          user_id: string
          status: string
          price_id: string
          plan: string
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: string
          price_id?: string
          plan?: string
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'subscriptions_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      usage_tracking: {
        Row: {
          id: string
          user_id: string | null
          session_id: string | null
          backtest_count: number
          session_start_at: string | null
          first_backtest_at: string | null
          last_backtest_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          session_id?: string | null
          backtest_count?: number
          session_start_at?: string | null
          first_backtest_at?: string | null
          last_backtest_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string | null
          session_id?: string | null
          backtest_count?: number
          session_start_at?: string | null
          first_backtest_at?: string | null
          last_backtest_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'usage_tracking_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
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
  }
}

// Convenience type aliases
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Subscription = Database['public']['Tables']['subscriptions']['Row']
export type UsageTracking = Database['public']['Tables']['usage_tracking']['Row']
