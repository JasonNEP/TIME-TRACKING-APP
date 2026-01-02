import { useState } from 'react'
import { supabase } from '../services/supabase'
import type { Profile } from '../types/database'
import PinVerifyModal from './PinVerifyModal'
import { usePinRequired } from '../hooks/usePinRequired'
import './ManualEntry.css'

interface ManualEntryProps {
  profiles: Profile[]
  onUpdate: () => void
}

export default function ManualEntry({ profiles, onUpdate }: ManualEntryProps) {
  const { pinRequired } = usePinRequired()
  const [isOpen, setIsOpen] = useState(false)
  const [showPinVerify, setShowPinVerify] = useState(false)
  const [formData, setFormData] = useState({
    profile_id: '',
    clock_in: '',
    clock_out: '',
    notes: ''
  })
  const [loading, setLoading] = useState(false)

  const handleOpenClick = () => {
    if (pinRequired) {
      setShowPinVerify(true)
    } else {
      setIsOpen(true)
    }
  }

  const handlePinSuccess = () => {
    setShowPinVerify(false)
    setIsOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.profile_id || !formData.clock_in || !formData.clock_out) {
      alert('Please fill in all required fields')
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
          profile_id: formData.profile_id,
          clock_in: new Date(formData.clock_in).toISOString(),
          clock_out: new Date(formData.clock_out).toISOString(),
          notes: formData.notes || null
        } as any)

      if (error) throw error

      setFormData({ profile_id: '', clock_in: '', clock_out: '', notes: '' })
      setIsOpen(false)
      onUpdate()
    } catch (error: any) {
      console.error('Error adding manual entry:', error)
      alert('Failed to add manual entry')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="manual-entry">
      {showPinVerify && (
        <PinVerifyModal 
          onSuccess={handlePinSuccess}
          onCancel={() => setShowPinVerify(false)}
        />
      )}

      {!isOpen ? (
        <button onClick={handleOpenClick} className="add-manual-btn">
          + Add Manual Time Entry
        </button>
      ) : (
        <div className="manual-entry-form">
          <h3>Add Manual Time Entry</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Profile *</label>
              <select
                value={formData.profile_id}
                onChange={(e) => setFormData({ ...formData, profile_id: e.target.value })}
                required
              >
                <option value="">Select a profile</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name} (${profile.hourly_rate}/hr)
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Clock In *</label>
              <input
                type="datetime-local"
                value={formData.clock_in}
                onChange={(e) => setFormData({ ...formData, clock_in: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Clock Out *</label>
              <input
                type="datetime-local"
                value={formData.clock_out}
                onChange={(e) => setFormData({ ...formData, clock_out: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
                  setIsOpen(false)
                  setFormData({ profile_id: '', clock_in: '', clock_out: '', notes: '' })
                }}
                className="cancel-btn"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
