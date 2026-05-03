import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import type { Profile, TimeEntry, TimeEntrySegment } from '../types/database'
import './ClockInOut.css'

interface ClockInOutProps {
  activeProfile: Profile | null
  onUpdate: () => void
}

export default function ClockInOut({ activeProfile, onUpdate }: ClockInOutProps) {
  const [entry, setEntry] = useState<TimeEntry | null>(null)
  const [segments, setSegments] = useState<TimeEntrySegment[]>([])
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [tick, setTick] = useState(0)
  const [showRates, setShowRates] = useState(() => {
    const saved = localStorage.getItem('showHourlyRates')
    return saved ? JSON.parse(saved) : false
  })

  useEffect(() => {
    const handleVisibilityChange = (e: CustomEvent) => setShowRates(e.detail)
    window.addEventListener('hourlyRatesVisibilityChanged', handleVisibilityChange as EventListener)
    return () => window.removeEventListener('hourlyRatesVisibilityChanged', handleVisibilityChange as EventListener)
  }, [])

  useEffect(() => {
    loadActiveEntry()
  }, [activeProfile])

  // Tick every second only while actively clocked in
  useEffect(() => {
    if (entry?.status !== 'active') return
    const interval = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(interval)
  }, [entry?.status])

  const loadActiveEntry = async () => {
    if (!activeProfile) {
      setEntry(null)
      setSegments([])
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: entries, error } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('profile_id', activeProfile.id)
      .in('status', ['active', 'paused'])
      .order('clock_in', { ascending: false })
      .limit(1)

    if (error) {
      console.error('Error loading active entry:', error)
      setEntry(null)
      setSegments([])
      return
    }

    if (!entries || entries.length === 0) {
      setEntry(null)
      setSegments([])
      return
    }

    const activeEntry = entries[0] as TimeEntry
    setEntry(activeEntry)

    const { data: segs } = await supabase
      .from('time_entry_segments')
      .select('*')
      .eq('time_entry_id', activeEntry.id)
      .order('start_time', { ascending: true })

    setSegments((segs || []) as TimeEntrySegment[])
  }

  // Sum all segment durations; open segment counts toward elapsed only when active
  const calculateElapsedMs = (): number => {
    return segments.reduce((total, seg) => {
      const start = new Date(seg.start_time).getTime()
      const end = seg.end_time
        ? new Date(seg.end_time).getTime()
        : (entry?.status === 'active' ? Date.now() : start)
      return total + Math.max(0, end - start)
    }, 0)
  }

  const formatElapsed = (ms: number): string => {
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const handleClockIn = async () => {
    if (!activeProfile) {
      alert('Please select a profile first')
      return
    }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const now = new Date().toISOString()

    const { data: newEntry, error: entryError } = await supabase
      .from('time_entries')
      .insert({
        user_id: user.id,
        profile_id: activeProfile.id,
        clock_in: now,
        status: 'active',
        notes: notes || null,
      } as any)
      .select()
      .single()

    if (entryError || !newEntry) {
      console.error('Error clocking in:', entryError)
      alert('Failed to clock in')
      setLoading(false)
      return
    }

    const { error: segError } = await supabase
      .from('time_entry_segments')
      .insert({
        time_entry_id: newEntry.id,
        user_id: user.id,
        start_time: now,
      } as any)

    if (segError) {
      console.error('Error creating segment:', segError)
    }

    setNotes('')
    await loadActiveEntry()
    onUpdate()
    setLoading(false)
  }

  const handlePause = async () => {
    if (!entry) return
    setLoading(true)

    const now = new Date().toISOString()

    // Close the open segment
    await supabase
      .from('time_entry_segments')
      .update({ end_time: now } as any)
      .eq('time_entry_id', entry.id)
      .is('end_time', null)

    // Mark entry as paused
    await supabase
      .from('time_entries')
      .update({ status: 'paused' } as any)
      .eq('id', entry.id)

    await loadActiveEntry()
    onUpdate()
    setLoading(false)
  }

  const handleResume = async () => {
    if (!entry) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const now = new Date().toISOString()

    // Create a new segment
    await supabase
      .from('time_entry_segments')
      .insert({
        time_entry_id: entry.id,
        user_id: user.id,
        start_time: now,
      } as any)

    // Mark entry as active
    await supabase
      .from('time_entries')
      .update({ status: 'active' } as any)
      .eq('id', entry.id)

    await loadActiveEntry()
    onUpdate()
    setLoading(false)
  }

  const handleClockOut = async () => {
    if (!entry) return
    setLoading(true)

    const now = new Date().toISOString()

    // Close any open segment
    await supabase
      .from('time_entry_segments')
      .update({ end_time: now } as any)
      .eq('time_entry_id', entry.id)
      .is('end_time', null)

    // Complete the entry
    await supabase
      .from('time_entries')
      .update({
        clock_out: now,
        status: 'completed',
        notes: notes || entry.notes,
      } as any)
      .eq('id', entry.id)

    setNotes('')
    setEntry(null)
    setSegments([])
    onUpdate()
    setLoading(false)
  }

  const elapsedMs = calculateElapsedMs()

  return (
    <div className="clock-card">
      <h2>Time Clock</h2>

      {activeProfile ? (
        <>
          <div className="active-profile">
            <strong>Active Profile:</strong> {activeProfile.name}
            {showRates && <span className="rate">${activeProfile.hourly_rate}/hr</span>}
          </div>

          {entry ? (
            <>
              <div className="timer">
                <div className="elapsed-time">{formatElapsed(elapsedMs)}</div>
                <div className={`status ${entry.status === 'paused' ? 'status-paused' : ''}`}>
                  {entry.status === 'active' ? 'Clocked In' : 'Paused'}
                </div>
                {segments.length > 1 && (
                  <div className="segment-count">
                    {segments.length} work segments
                  </div>
                )}
              </div>

              <textarea
                placeholder="Add notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />

              <div className="clock-btn-row">
                {entry.status === 'active' ? (
                  <button
                    className="clock-btn pause-btn"
                    onClick={handlePause}
                    disabled={loading}
                  >
                    {loading ? '...' : 'Pause'}
                  </button>
                ) : (
                  <button
                    className="clock-btn resume-btn"
                    onClick={handleResume}
                    disabled={loading}
                  >
                    {loading ? '...' : 'â–¶ Resume'}
                  </button>
                )}
                <button
                  className="clock-btn clock-out-btn"
                  onClick={handleClockOut}
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Clock Out'}
                </button>
              </div>
            </>
          ) : (
            <>
              <textarea
                placeholder="Add notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
              <button
                className="clock-btn clock-in-btn"
                onClick={handleClockIn}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Clock In'}
              </button>
            </>
          )}
        </>
      ) : (
        <p className="no-profile">Please create a profile to start tracking time</p>
      )}
    </div>
  )
}
