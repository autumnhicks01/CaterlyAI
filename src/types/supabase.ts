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
          created_at: string
          updated_at: string
          email: string | null
          name: string | null
        }
        Insert: {
          id: string
          created_at?: string
          updated_at?: string
          email?: string | null
          name?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          email?: string | null
          name?: string | null
        }
      },
      user_profiles: {
        Row: {
          id: string
          user_id: string
          business_name: string | null
          full_address: string | null
          delivery_radius: number | null
          business_type: string | null
          contact_phone: string | null
          website_url: string | null
          user_input_data: Json | null
          ai_profile_data: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          business_name?: string | null
          full_address?: string | null
          delivery_radius?: number | null
          business_type?: string | null
          contact_phone?: string | null
          website_url?: string | null
          user_input_data?: Json | null
          ai_profile_data?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          business_name?: string | null
          full_address?: string | null
          delivery_radius?: number | null
          business_type?: string | null
          contact_phone?: string | null
          website_url?: string | null
          user_input_data?: Json | null
          ai_profile_data?: Json | null
          created_at?: string
          updated_at?: string
        }
      },
      waitlist: {
        Row: {
          id: string
          email: string
          created_at: string
          notes: string | null
        }
        Insert: {
          id?: string
          email: string
          created_at?: string
          notes?: string | null
        }
        Update: {
          id?: string
          email?: string
          created_at?: string
          notes?: string | null
        }
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