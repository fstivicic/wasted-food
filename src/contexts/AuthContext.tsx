import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase, isDemoMode } from '@/lib/supabase'
import type { Restaurant, Role } from '@/types/database'

interface AuthState {
  user: User | null
  session: Session | null
  restaurant: Restaurant | null
  role: Role | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  createRestaurant: (name: string) => Promise<{ error: Error | null }>
  refreshRestaurant: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

const DEMO_USER = isDemoMode ? ({
  id: '00000000-0000-0000-0000-000000000001',
  email: 'demo@konobamaslina.hr',
  app_metadata: {},
  user_metadata: { full_name: 'Demo Korisnik' },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
} as unknown as User) : null

const DEMO_SESSION = DEMO_USER
  ? ({ user: DEMO_USER, access_token: 'demo', refresh_token: 'demo' } as unknown as Session)
  : null

function getDemoRestaurant(): Restaurant | null {
  try {
    const data = JSON.parse(localStorage.getItem('wf_demo_restaurants') || '[]')
    return data[0] ?? null
  } catch { return null }
}

function getDemoRole(): Role | null {
  try {
    const data = JSON.parse(localStorage.getItem('wf_demo_restaurant_members') || '[]')
    return (data[0]?.role as Role) ?? null
  } catch { return null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(DEMO_USER)
  const [session, setSession] = useState<Session | null>(DEMO_SESSION)
  const [restaurant, setRestaurant] = useState<Restaurant | null>(isDemoMode ? getDemoRestaurant() : null)
  const [role, setRole] = useState<Role | null>(isDemoMode ? getDemoRole() : null)
  const [loading, setLoading] = useState(!isDemoMode)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  async function loadRestaurant(userId: string) {
    const { data: membership } = await sb
      .from('restaurant_members')
      .select('restaurant_id, role')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (membership) {
      const { data: rest } = await sb
        .from('restaurants')
        .select('*')
        .eq('id', membership.restaurant_id)
        .single()

      setRestaurant(rest)
      setRole(membership.role as Role)
    } else {
      setRestaurant(null)
      setRole(null)
    }
  }

  useEffect(() => {
    if (isDemoMode) return

    supabase.auth.getSession().then(({ data: { session: s } }: any) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) {
        loadRestaurant(s.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, s: any) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) {
        loadRestaurant(s.user.id)
      } else {
        setRestaurant(null)
        setRole(null)
      }
    })

    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signIn = async (email: string, password: string) => {
    if (isDemoMode) return { error: null }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error as Error | null }
  }

  const signUp = async (email: string, password: string) => {
    if (isDemoMode) return { error: null }
    const { error } = await supabase.auth.signUp({ email, password })
    return { error: error as Error | null }
  }

  const signOut = async () => {
    if (!isDemoMode) await supabase.auth.signOut()
    setRestaurant(null)
    setRole(null)
  }

  const createRestaurant = async (name: string) => {
    if (!user) return { error: new Error('Not authenticated') }

    const { data, error } = await sb
      .from('restaurants')
      .insert({ name, owner_id: user.id, address: null, currency: 'EUR', locale: 'hr' })
      .select()
      .single()

    if (error) return { error: error as unknown as Error }

    await sb
      .from('restaurant_members')
      .insert({ restaurant_id: data.id, user_id: user.id, role: 'owner' })

    await loadRestaurant(user.id)
    return { error: null }
  }

  const refreshRestaurant = async () => {
    if (user) await loadRestaurant(user.id)
  }

  return (
    <AuthContext.Provider value={{ user, session, restaurant, role, loading, signIn, signUp, signOut, createRestaurant, refreshRestaurant }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
