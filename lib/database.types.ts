export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      posts: {
        Row: {
          id: string
          user_id: string
          content: string
          scheduled_for: string
          published: boolean
          created_at: string
          updated_at: string
          media_urls: string[] | null
          status: "draft" | "scheduled" | "published" | "failed"
        }
        Insert: {
          id?: string
          user_id: string
          content: string
          scheduled_for: string
          published?: boolean
          created_at?: string
          updated_at?: string
          media_urls?: string[] | null
          status?: "draft" | "scheduled" | "published" | "failed"
        }
        Update: {
          id?: string
          user_id?: string
          content?: string
          scheduled_for?: string
          published?: boolean
          created_at?: string
          updated_at?: string
          media_urls?: string[] | null
          status?: "draft" | "scheduled" | "published" | "failed"
        }
      }
      profiles: {
        Row: {
          id: string
          updated_at: string
          username: string
          full_name: string
          avatar_url: string | null
          x_handle: string | null
        }
        Insert: {
          id: string
          updated_at?: string
          username: string
          full_name: string
          avatar_url?: string | null
          x_handle?: string | null
        }
        Update: {
          id?: string
          updated_at?: string
          username?: string
          full_name?: string
          avatar_url?: string | null
          x_handle?: string | null
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