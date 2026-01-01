import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'

export const useUserRole = () => {
  const [role, setRole] = useState<'admin' | 'user' | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUserRole()
  }, [])

  const fetchUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setRole(null)
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single()

      if (error) {
        console.error('Error fetching user role:', error)
        setRole('user') // Default to user
      } else {
        setRole(data?.role || 'user')
      }
    } catch (error) {
      console.error('Error:', error)
      setRole('user')
    } finally {
      setLoading(false)
    }
  }

  return { role, loading, isAdmin: role === 'admin' }
}
