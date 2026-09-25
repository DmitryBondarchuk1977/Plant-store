import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type AuthState = {
  session: Session | null
  isAdmin: boolean
  loading: boolean
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  // Следим за сессией Supabase
  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  // При изменении сессии проверяем, есть ли пользователь в admins
  useEffect(() => {
    let active = true
    async function check() {
      if (!session) {
        setIsAdmin(false)
        setLoading(false)
        return
      }
      setLoading(true)
      const { data, error } = await supabase.rpc('is_admin')
      if (!active) return
      setIsAdmin(!error && data === true)
      setLoading(false)
    }
    check()
    return () => {
      active = false
    }
  }, [session])

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <Ctx.Provider value={{ session, isAdmin, loading, signOut }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth должен использоваться внутри AuthProvider')
  return c
}
