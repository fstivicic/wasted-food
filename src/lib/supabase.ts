import { createClient } from '@supabase/supabase-js'
import { createMockSupabaseClient } from './mock-supabase'
import { seedDemoData } from './demo-data'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isDemoMode = !supabaseUrl || !supabaseAnonKey || supabaseUrl === 'https://demo.supabase.co'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function initClient(): any {
  if (isDemoMode) {
    seedDemoData()
    return createMockSupabaseClient()
  }
  return createClient(supabaseUrl!, supabaseAnonKey!)
}

export const supabase = initClient()
