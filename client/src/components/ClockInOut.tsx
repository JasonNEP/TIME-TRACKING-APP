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

  useEffect(() => {
    checkActiveEntry()
  }, [activeProfile])

  const checkActiveEntry = async () => {
    if (!activeProfile) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('profile_id', activeProfile.id)
      .is('clock_out', null)
      .single()

    setActiveEntry(data)
  }

  const handleClockIn = async () => {
    if (!activeProfile) {
      alert('Please select a profile first')
      return
    }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

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
      checkActiveEntry()
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
      })
      .eq('id', activeEntry.id)

    if (error) {
      console.error('Error clocking out:', error)
      alert('Failed to clock out')
    } else {
      setNotes('')
      setActiveEntry(null)
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
            <span className="rate">${activeProfile.hourly_rate}/hr</span>
          </div>

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
