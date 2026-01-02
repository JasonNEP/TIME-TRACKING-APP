import { useState } from 'react'
import { supabase } from '../services/supabase'
import type { Profile, TimeEntry } from '../types/database'
import PinVerifyModal from './PinVerifyModal'
import './TimeEntryList.css'

interface TimeEntryListProps {
  timeEntries: TimeEntry[]
  profiles: Profile[]
  isAdmin: boolean
  onUpdate: () => void
}

export default function TimeEntryList({ timeEntries, profiles, isAdmin, onUpdate }: TimeEntryListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showPinVerify, setShowPinVerify] = useState(false)
  const [pendingAction, setPendingAction] = useState<{type: 'edit' | 'delete', entryId: string} | null>(null)
  const [editForm, setEditForm] = useState<{
    clock_in: string
    clock_out: string
    notes: string
  }>({ clock_in: '', clock_out: '', notes: '' })
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

  const calculateDuration = (clockIn: string, clockOut: string | null) => {
    if (!clockOut) return 'In progress'
    
    const start = new Date(clockIn).getTime()
    const end = new Date(clockOut).getTime()
    const diff = end - start
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    return `${hours}h ${minutes}m`
  }

  const calculateEarnings = (entry: TimeEntry) => {
    if (!entry.clock_out) return '$0.00'
    
    const start = new Date(entry.clock_in).getTime()
    const end = new Date(entry.clock_out).getTime()
    const hours = (end - start) / (1000 * 60 * 60)
    const rate = getProfileRate(entry.profile_id)
    const earnings = hours * rate
    
    return `$${earnings.toFixed(2)}`
  }

  const handleEdit = (entry: TimeEntry) => {
    setPendingAction({ type: 'edit', entryId: entry.id })
    setEditForm({
      clock_in: entry.clock_in.slice(0, 16),
      clock_out: entry.clock_out ? entry.clock_out.slice(0, 16) : '',
      notes: entry.notes || ''
    })
    setShowPinVerify(true)
  }

  const handleDelete = (entryId: string) => {
    setPendingAction({ type: 'delete', entryId })
    setShowPinVerify(true)
  }

  const handlePinSuccess = () => {
    setShowPinVerify(false)
    if (pendingAction) {
      if (pendingAction.type === 'edit') {
        setEditingId(pendingAction.entryId)
      } else if (pendingAction.type === 'delete') {
        confirmDelete(pendingAction.entryId)
      }
      setPendingAction(null)
    }
  }

  const handleSaveEdit = async (entryId: string) => {
    const { error } = await supabase
      .from('time_entries')
      .update({
        clock_in: new Date(editForm.clock_in).toISOString(),
        clock_out: editForm.clock_out ? new Date(editForm.clock_out).toISOString() : null,
        notes: editForm.notes || null,
        updated_at: new Date().toISOString()
      } as any)
      .eq('id', entryId)

    if (error) {
      console.error('Error updating entry:', error)
      alert('Failed to update entry')
    } else {
      setEditingId(null)
      onUpdate()
    }
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

      <h2>Recent Time Entries</h2>
      
      {timeEntries.length === 0 ? (
        <p className="no-entries">No time entries yet. Clock in to get started!</p>
      ) : (
        <div className="entries">
          {timeEntries.map((entry) => (
            <div key={entry.id} className={`entry-item ${!entry.clock_out ? 'active' : ''}`}>
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
                    {calculateDuration(entry.clock_in, entry.clock_out)}
                  </div>
                  
                  {entry.notes && (
                    <div className="entry-notes">
                      {entry.notes}
                    </div>
                  )}

                  {isAdmin && entry.clock_out && (
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
