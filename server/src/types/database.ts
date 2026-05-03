export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          user_id: string
          name: string
          hourly_rate: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          hourly_rate: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          hourly_rate?: number
          created_at?: string
          updated_at?: string
        }
      }
      time_entries: {
        Row: {
          id: string
          user_id: string
          profile_id: string
          clock_in: string
          clock_out: string | null
          notes: string | null
          status: 'active' | 'paused' | 'completed'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          profile_id: string
          clock_in?: string
          clock_out?: string | null
          notes?: string | null
          status?: 'active' | 'paused' | 'completed'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          profile_id?: string
          clock_in?: string
          clock_out?: string | null
          notes?: string | null
          status?: 'active' | 'paused' | 'completed'
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

export interface TimeEntrySegment {
  id: string
  time_entry_id: string
  user_id: string
  start_time: string
  end_time: string | null
  created_at: string
}

export interface TimeEntry {
  id: string
  user_id: string
  profile_id: string
  clock_in: string
  clock_out: string | null
  notes: string | null
  status: 'active' | 'paused' | 'completed'
  created_at: string
  updated_at: string
  time_entry_segments?: TimeEntrySegment[]
}
