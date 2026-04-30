import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import type { Profile, TimeEntry } from '../types/database'
import './ClockInOut.css'

interface ClockInOutProps {
  activeProfile: Profile | null
  onUpdate: () => void
}

export default function ClockInOut({ activeProfile, onUpdate }: ClockInOutProps) {
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [openEntryCount, setOpenEntryCount] = useState(0)
  const [showRates, setShowRates] = useState(() => {
    const saved = localStorage.getItem('showHourlyRates')
    return saved ? JSON.parse(saved) : false
  })

  useEffect(() => {
    const handleVisibilityChange = (e: CustomEvent) => {
      setShowRates(e.detail)
    }
    window.addEventListener('hourlyRatesVisibilityChanged', handleVisibilityChange as EventListener)
    return () => {
      window.removeEventListener('hourlyRatesVisibilityChanged', handleVisibilityChange as EventListener)
    }
  }, [])

  useEffect(() => {
    checkActiveEntry()
  }, [activeProfile])

  const checkActiveEntry = async () => {
    if (!activeProfile) {
      setActiveEntry(null)
      setOpenEntryCount(0)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('profile_id', activeProfile.id)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })

    if (error) {
      console.error('Error checking active entry:', error)
      setActiveEntry(null)
      setOpenEntryCount(0)
      return
    }

    const openEntries = data || []
    setOpenEntryCount(openEntries.length)
    setActiveEntry(openEntries[0] || null)
  }

  const handleClockIn = async () => {
    if (!activeProfile) {
      alert('Please select a profile first')
      return
    }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data: existingEntries, error: existingEntriesError } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('profile_id', activeProfile.id)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })

    if (existingEntriesError) {
      console.error('Error checking existing entries:', existingEntriesError)
      alert('Failed to verify current clock-in status')
      setLoading(false)
      return
    }

    if (existingEntries && existingEntries.length > 0) {
      setOpenEntryCount(existingEntries.length)
      setActiveEntry(existingEntries[0])
      alert('This profile is already clocked in. Please clock it out before starting another entry.')
      setLoading(false)
      return
    }

    const { error } = await supabase
      .from('time_entries')
      .insert({
        user_id: user.id,
        profile_id: activeProfile.id,
        clock_in: new Date().toISOString(),
        notes: notes || null,
      } as any)

    if (error) {
      console.error('Error clocking in:', error)
      alert('Failed to clock in')
    } else {
      setNotes('')
      await checkActiveEntry()
      onUpdate()
    }
    setLoading(false)
  }

  const handleClockOut = async () => {
    if (!activeEntry) return

    setLoading(true)
    const { error } = await supabase
      .from('time_entries')
      .update({ 
        clock_out: new Date().toISOString(),
        notes: notes || activeEntry.notes 
      } as any)
      .eq('id', activeEntry.id)

    if (error) {
      console.error('Error clocking out:', error)
      alert('Failed to clock out')
    } else {
      setNotes('')
      await checkActiveEntry()
      onUpdate()
    }
    setLoading(false)
  }

  const getElapsedTime = () => {
    if (!activeEntry) return '00:00:00'
    
    const start = new Date(activeEntry.clock_in).getTime()
    const now = Date.now()
    const diff = now - start
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  useEffect(() => {
    if (!activeEntry) return
    
    const interval = setInterval(() => {
      // Force re-render every second
      setActiveEntry({ ...activeEntry })
    }, 1000)
    
    return () => clearInterval(interval)
  }, [activeEntry])

  return (
    <div className="clock-card">
      <h2>Time Clock</h2>
      
      {activeProfile ? (
        <>
          <div className="active-profile">
            <strong>Active Profile:</strong> {activeProfile.name}
            {showRates && <span className="rate">${activeProfile.hourly_rate}/hr</span>}
          </div>

          {openEntryCount > 1 && (
            <div className="clock-warning">
              This profile has {openEntryCount} open time entries. Clocking out will close the most recent one first.
            </div>
          )}

          {activeEntry && (
            <div className="timer">
              <div className="elapsed-time">{getElapsedTime()}</div>
              <div className="status">Clocked In</div>
            </div>
          )}

          <textarea
            placeholder="Add notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />

          {!activeEntry ? (
            <button 
              className="clock-btn clock-in-btn" 
              onClick={handleClockIn}
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Clock In'}
            </button>
          ) : (
            <button 
              className="clock-btn clock-out-btn" 
              onClick={handleClockOut}
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Clock Out'}
            </button>
          )}
        </>
      ) : (
        <p className="no-profile">Please create a profile to start tracking time</p>
      )}
    </div>
  )
}
