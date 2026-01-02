import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'

export function usePinRequired() {
  const [pinRequired, setPinRequired] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkPinRequired()
  }, [])

  const checkPinRequired = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setPinRequired(true)
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('user_roles')
        .select('require_pin')
        .eq('user_id', user.id)
        .single()

      setPinRequired(data?.require_pin ?? true)
    } catch (err) {
      console.error('Error checking PIN requirement:', err)
      setPinRequired(true)
    } finally {
      setLoading(false)
    }
  }

  return { pinRequired, loading, refresh: checkPinRequired }
}
