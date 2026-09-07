import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import type { Profile, TimeEntry } from '../types/database'
import PinVerifyModal from './PinVerifyModal'
import { usePinRequired } from '../hooks/usePinRequired'
import './TimeEntryList.css'

type EntryViewMode = 'recent' | 'week' | 'range'

interface TimeEntryListProps {
  timeEntries: TimeEntry[]
  profiles: Profile[]
  isAdmin: boolean
  onUpdate: () => void
  onRefresh: () => void
  activeProfile: Profile | null
  entryViewMode: EntryViewMode
  onEntryViewModeChange: (mode: EntryViewMode) => void
  entryLimit: number
  onEntryLimitChange: (limit: number) => void
  startDate: string
  endDate: string
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
  onSaveViewAsDefault: () => void
}

export default function TimeEntryList({
  timeEntries,
  profiles,
  isAdmin,
  onUpdate,
  onRefresh,
  activeProfile,
  entryViewMode,
  onEntryViewModeChange,
  entryLimit,
  onEntryLimitChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onSaveViewAsDefault,
}: TimeEntryListProps) {
  const { pinRequired } = usePinRequired()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showPinVerify, setShowPinVerify] = useState(false)
  const [pendingAction, setPendingAction] = useState<{type: 'edit' | 'delete' | 'add', entryId?: string} | null>(null)
  const [editForm, setEditForm] = useState<{
    clock_in: string
    clock_out: string
    notes: string
  }>({ clock_in: '', clock_out: '', notes: '' })
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [manualEntryForm, setManualEntryForm] = useState({
    profile_id: '',
    clock_in: '',
    clock_out: '',
    notes: ''
  })
  const [loading, setLoading] = useState(false)
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
  const getProfileName = (profileId: string) => {
    const profile = profiles.find(p => p.id === profileId)
    return profile?.name || 'Unknown'
  }

  const getProfileRate = (profileId: string) => {
    const profile = profiles.find(p => p.id === profileId)
    return profile?.hourly_rate || 0
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const calcWorkedMs = (entry: TimeEntry): number => {
    const segs = entry.time_entry_segments
    if (segs && segs.length > 0) {
      return segs.reduce((total, seg) => {
        const start = new Date(seg.start_time).getTime()
        const end = seg.end_time ? new Date(seg.end_time).getTime() : Date.now()
        return total + Math.max(0, end - start)
      }, 0)
    }
    // Fallback for entries without segments
    if (!entry.clock_out) return 0
    return Math.max(0, new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime())
  }

  const calculateDuration = (entry: TimeEntry): string => {
    if (entry.status === 'active') return 'Active ▶'
    if (entry.status === 'paused') {
      const ms = calcWorkedMs(entry)
      const h = Math.floor(ms / 3600000)
      const m = Math.floor((ms % 3600000) / 60000)
      return `${h}h ${m}m (Paused)`
    }
    const ms = calcWorkedMs(entry)
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    return `${h}h ${m}m`
  }

  const calculateEarnings = (entry: TimeEntry): string => {
    if (entry.status !== 'completed') return '$0.00'
    const ms = calcWorkedMs(entry)
    const hours = ms / 3600000
    const rate = getProfileRate(entry.profile_id)
    return `$${(hours * rate).toFixed(2)}`
  }

  const getStartOfDayIso = (dateStr: string) => new Date(`${dateStr}T00:00:00`).toISOString()
  const getEndOfDayIso = (dateStr: string) => new Date(`${dateStr}T23:59:59`).toISOString()

  const getCurrentWeekRange = () => {
    const now = new Date()
    const day = now.getDay()

    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    start.setDate(now.getDate() - day)

    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)

    return { start, end }
  }

  const filteredEntries = timeEntries.filter((entry) => {
    if (entryViewMode === 'recent') return true

    const clockInMs = new Date(entry.clock_in).getTime()

    if (entryViewMode === 'week') {
      const { start, end } = getCurrentWeekRange()
      return clockInMs >= start.getTime() && clockInMs <= end.getTime()
    }

    if (entryViewMode === 'range') {
      if (startDate && clockInMs < new Date(getStartOfDayIso(startDate)).getTime()) return false
      if (endDate && clockInMs > new Date(getEndOfDayIso(endDate)).getTime()) return false
      return true
    }

    return true
  })

  const displayedEntries =
    entryViewMode === 'recent' ? filteredEntries.slice(0, entryLimit) : filteredEntries

  const totals = displayedEntries.reduce(
    (acc, entry) => {
      if (entry.status !== 'completed') return acc
      const hours = calcWorkedMs(entry) / 3600000
      const rate = getProfileRate(entry.profile_id)
      acc.hours += hours
      acc.pay += hours * rate
      return acc
    },
    { hours: 0, pay: 0 }
  )

  const handleRefresh = () => {
    if (
      entryViewMode === 'range' &&
      startDate &&
      endDate &&
      new Date(endDate).getTime() < new Date(startDate).getTime()
    ) {
      alert('End date cannot be before start date')
      return
    }

    onRefresh()
  }

  // Convert UTC timestamp to local datetime-local format
  const toLocalDateTimeString = (isoString: string) => {
    const date = new Date(isoString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  const handleEdit = (entry: TimeEntry) => {
    if (pinRequired) {
      setPendingAction({ type: 'edit', entryId: entry.id })
      setEditForm({
        clock_in: toLocalDateTimeString(entry.clock_in),
        clock_out: entry.clock_out ? toLocalDateTimeString(entry.clock_out) : '',
        notes: entry.notes || ''
      })
      setShowPinVerify(true)
    } else {
      setEditingId(entry.id)
      setEditForm({
        clock_in: toLocalDateTimeString(entry.clock_in),
        clock_out: entry.clock_out ? toLocalDateTimeString(entry.clock_out) : '',
        notes: entry.notes || ''
      })
    }
  }

  const handleDelete = (entryId: string) => {
    if (pinRequired) {
      setPendingAction({ type: 'delete', entryId })
      setShowPinVerify(true)
    } else {
      confirmDelete(entryId)
    }
  }

  const handlePinSuccess = () => {
    setShowPinVerify(false)
    if (pendingAction) {
      if (pendingAction.type === 'edit' && pendingAction.entryId) {
        setEditingId(pendingAction.entryId)
      } else if (pendingAction.type === 'delete' && pendingAction.entryId) {
        confirmDelete(pendingAction.entryId)
      } else if (pendingAction.type === 'add') {
        setShowManualEntry(true)
      }
      setPendingAction(null)
    }
  }

  const handleAddManualEntry = () => {
    if (pinRequired) {
      setPendingAction({ type: 'add' })
      setShowPinVerify(true)
    } else {
      setShowManualEntry(true)
    }
  }

  const handleManualEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualEntryForm.profile_id || !manualEntryForm.clock_in || !manualEntryForm.clock_out) {
      alert('Please fill in all required fields')
      return
    }

    if (new Date(manualEntryForm.clock_out).getTime() < new Date(manualEntryForm.clock_in).getTime()) {
      alert('Clock Out cannot be earlier than Clock In')
      return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('time_entries')
        .insert({
          user_id: user.id,
          profile_id: manualEntryForm.profile_id,
          clock_in: new Date(manualEntryForm.clock_in).toISOString(),
          clock_out: new Date(manualEntryForm.clock_out).toISOString(),
          status: 'completed',
          notes: manualEntryForm.notes || null
        } as any)

      if (error) throw error

      // Also create the matching segment
      const { data: newEntries } = await supabase
        .from('time_entries')
        .select('id')
        .eq('user_id', user.id)
        .eq('profile_id', manualEntryForm.profile_id)
        .eq('clock_in', new Date(manualEntryForm.clock_in).toISOString())
        .single()

      if (newEntries) {
        await supabase.from('time_entry_segments').insert({
          time_entry_id: (newEntries as any).id,
          user_id: user.id,
          start_time: new Date(manualEntryForm.clock_in).toISOString(),
          end_time: new Date(manualEntryForm.clock_out).toISOString(),
        } as any)
      }

      setManualEntryForm({ profile_id: '', clock_in: '', clock_out: '', notes: '' })
      setShowManualEntry(false)
      onUpdate()
    } catch (error: any) {
      console.error('Error adding manual entry:', error)
      alert('Failed to add manual entry')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveEdit = async (entryId: string) => {
    const newClockIn = new Date(editForm.clock_in).toISOString()
    const newClockOut = editForm.clock_out ? new Date(editForm.clock_out).toISOString() : null

    if (newClockOut && new Date(newClockOut).getTime() < new Date(newClockIn).getTime()) {
      alert('Clock Out cannot be earlier than Clock In')
      return
    }

    const { error } = await supabase
      .from('time_entries')
      .update({
        clock_in: newClockIn,
        clock_out: newClockOut,
        notes: editForm.notes || null,
        updated_at: new Date().toISOString()
      } as any)
      .eq('id', entryId)

    if (error) {
      console.error('Error updating entry:', error)
      alert('Failed to update entry')
      return
    }

    // Update segments so pay calculation stays in sync
    if (newClockOut) {
      await supabase
        .from('time_entry_segments')
        .update({ start_time: newClockIn, end_time: newClockOut } as any)
        .eq('time_entry_id', entryId)
    }

    setEditingId(null)
    onUpdate()
  }

  const confirmDelete = async (entryId: string) => {
    if (!confirm('Are you sure you want to delete this entry?')) return

    const { error } = await supabase
      .from('time_entries')
      .delete()
      .eq('id', entryId)

    if (error) {
      console.error('Error deleting entry:', error)
      alert('Failed to delete entry')
    } else {
      onUpdate()
    }
  }

  return (
    <div className="time-entry-list">
      {showPinVerify && (
        <PinVerifyModal 
          onSuccess={handlePinSuccess}
          onCancel={() => {
            setShowPinVerify(false)
            setPendingAction(null)
          }}
        />
      )}

      <div className="list-header">
        <h2>Recent Time Entries</h2>
        {isAdmin && (
          <button onClick={handleAddManualEntry} className="add-manual-btn-inline">
            + Add Manual Entry
          </button>
        )}
      </div>

      <div className="list-controls">
        <label htmlFor="entries-view-mode" className="entries-limit-label">View</label>
        <select
          id="entries-view-mode"
          className="entries-limit-select"
          value={entryViewMode}
          onChange={(e) => onEntryViewModeChange(e.target.value as EntryViewMode)}
        >
          <option value="recent">Recent</option>
          <option value="week">This Week (Sun-Sat)</option>
          <option value="range">Date Range</option>
        </select>

        {entryViewMode === 'recent' && (
          <>
            <label htmlFor="entries-limit" className="entries-limit-label">Show</label>
            <select
              id="entries-limit"
              className="entries-limit-select"
              value={entryLimit}
              onChange={(e) => {
                const nextLimit = Number(e.target.value)
                if (nextLimit !== entryLimit) {
                  onEntryLimitChange(nextLimit)
                }
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
            </select>
          </>
        )}

        {entryViewMode === 'range' && (
          <>
            <label htmlFor="start-date" className="entries-limit-label">From</label>
            <input
              id="start-date"
              className="entries-date-input"
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
            />
            <label htmlFor="end-date" className="entries-limit-label">To</label>
            <input
              id="end-date"
              className="entries-date-input"
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
            />
          </>
        )}

        <button type="button" className="apply-filter-btn" onClick={handleRefresh}>
          Refresh
        </button>
        <button type="button" className="save-default-btn" onClick={onSaveViewAsDefault}>
          Save As Profile Default
        </button>
        <span className="entries-limit-label">{displayedEntries.length} loaded</span>
      </div>

      <div className="entry-summary">
        <div className="summary-item">
          <span className="summary-label">Hours</span>
          <strong>{totals.hours.toFixed(2)}</strong>
        </div>
        <div className="summary-item">
          <span className="summary-label">Pay</span>
          <strong>${totals.pay.toFixed(2)}</strong>
        </div>
      </div>

      {showManualEntry && (
        <div className="manual-entry-form-inline">
          <h3>Add Manual Time Entry</h3>
          <form onSubmit={handleManualEntrySubmit}>
            <div className="form-group">
              <label>Profile *</label>
              <select
                value={manualEntryForm.profile_id}
                onChange={(e) => setManualEntryForm({ ...manualEntryForm, profile_id: e.target.value })}
                required
              >
                <option value="">Select a profile</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}{showRates ? ` ($${profile.hourly_rate}/hr)` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Clock In *</label>
              <input
                type="datetime-local"
                value={manualEntryForm.clock_in}
                onChange={(e) => setManualEntryForm({ ...manualEntryForm, clock_in: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Clock Out *</label>
              <input
                type="datetime-local"
                value={manualEntryForm.clock_out}
                onChange={(e) => setManualEntryForm({ ...manualEntryForm, clock_out: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Notes</label>
              <textarea
                value={manualEntryForm.notes}
                onChange={(e) => setManualEntryForm({ ...manualEntryForm, notes: e.target.value })}
                rows={3}
                placeholder="Optional notes..."
              />
            </div>

            <div className="form-actions">
              <button type="submit" disabled={loading} className="submit-btn">
                {loading ? 'Adding...' : 'Add Entry'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowManualEntry(false)
                  setManualEntryForm({ profile_id: '', clock_in: '', clock_out: '', notes: '' })
                }}
                className="cancel-btn"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
      
      {displayedEntries.length === 0 ? (
        <p className="no-entries">No time entries yet. Clock in to get started!</p>
      ) : (
        <div className="entries">
          {displayedEntries.map((entry) => (
            <div key={entry.id} className={`entry-item ${entry.status !== 'completed' ? 'active' : ''}`}>
              {editingId === entry.id ? (
                <div className="edit-form">
                  <div className="form-group">
                    <label>Clock In:</label>
                    <input
                      type="datetime-local"
                      value={editForm.clock_in}
                      onChange={(e) => setEditForm({ ...editForm, clock_in: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Clock Out:</label>
                    <input
                      type="datetime-local"
                      value={editForm.clock_out}
                      onChange={(e) => setEditForm({ ...editForm, clock_out: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Notes:</label>
                    <textarea
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="edit-actions">
                    <button onClick={() => handleSaveEdit(entry.id)} className="save-btn">
                      Save
                    </button>
                    <button onClick={() => setEditingId(null)} className="cancel-btn">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="entry-header">
                    <strong>{getProfileName(entry.profile_id)}</strong>
                    <span className="earnings">{calculateEarnings(entry)}</span>
                  </div>
                  
                  <div className="entry-times">
                    <div>
                      <span className="label">In:</span> {formatDateTime(entry.clock_in)}
                    </div>
                    {entry.clock_out && (
                      <div>
                        <span className="label">Out:</span> {formatDateTime(entry.clock_out)}
                      </div>
                    )}
                  </div>
                  
                  <div className="entry-duration">
                    {calculateDuration(entry)}
                  </div>
                  
                  {entry.notes && (
                    <div className="entry-notes">
                      {entry.notes}
                    </div>
                  )}

                  {isAdmin && entry.status === 'completed' && (
                    <div className="entry-actions">
                      <button onClick={() => handleEdit(entry)} className="edit-btn">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(entry.id)} className="delete-btn">
                        Delete
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
