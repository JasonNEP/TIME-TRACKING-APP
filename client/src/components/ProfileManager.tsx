import { useState } from 'react'
import { supabase } from '../services/supabase'
import type { Profile } from '../types/database'
import PinVerifyModal from './PinVerifyModal'
import { usePinRequired } from '../hooks/usePinRequired'
import './ProfileManager.css'

interface ProfileManagerProps {
  profiles: Profile[]
  activeProfile: Profile | null
  onProfilesUpdate: () => void
  onProfileSelect: (profile: Profile) => void
}

export default function ProfileManager({ 
  profiles, 
  activeProfile, 
  onProfilesUpdate, 
  onProfileSelect 
}: ProfileManagerProps) {
  const { pinRequired } = usePinRequired()
  const [isAdding, setIsAdding] = useState(false)
  const [newProfileName, setNewProfileName] = useState('')
  const [newProfileRate, setNewProfileRate] = useState('')
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editRate, setEditRate] = useState('')
  const [showPinVerify, setShowPinVerify] = useState(false)
  const [pendingAction, setPendingAction] = useState<{type: 'add' | 'edit' | 'delete', profileId?: string} | null>(null)

  const handleAddProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProfileName || !newProfileRate) return

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('profiles')
      .insert({
        user_id: user.id,
        name: newProfileName,
        hourly_rate: parseFloat(newProfileRate),
      } as any)

    if (error) {
      console.error('Error adding profile:', error)
      alert('Failed to add profile')
    } else {
      setNewProfileName('')
      setNewProfileRate('')
      setIsAdding(false)
      onProfilesUpdate()
    }
    setLoading(false)
  }

  const handleAddClick = () => {
    if (pinRequired) {
      setPendingAction({ type: 'add' })
      setShowPinVerify(true)
    } else {
      setIsAdding(true)
    }
  }

  const handleEditClick = (profile: Profile) => {
    if (pinRequired) {
      setPendingAction({ type: 'edit', profileId: profile.id })
      setEditName(profile.name)
      setEditRate(profile.hourly_rate.toString())
      setShowPinVerify(true)
    } else {
      setEditingId(profile.id)
      setEditName(profile.name)
      setEditRate(profile.hourly_rate.toString())
    }
  }

  const handleDeleteClick = (profileId: string) => {
    if (pinRequired) {
      setPendingAction({ type: 'delete', profileId })
      setShowPinVerify(true)
    } else {
      confirmDelete(profileId)
    }
  }

  const handlePinSuccess = () => {
    setShowPinVerify(false)
    if (pendingAction) {
      if (pendingAction.type === 'add') {
        setIsAdding(true)
      } else if (pendingAction.type === 'edit' && pendingAction.profileId) {
        setEditingId(pendingAction.profileId)
      } else if (pendingAction.type === 'delete' && pendingAction.profileId) {
        confirmDelete(pendingAction.profileId)
      }
      setPendingAction(null)
    }
  }

  const confirmDelete = async (profileId: string) => {
    if (!confirm('Are you sure you want to delete this profile?')) return

    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', profileId)

    if (error) {
      console.error('Error deleting profile:', error)
      alert('Failed to delete profile')
    } else {
      onProfilesUpdate()
    }
  }

  const handleDeleteProfile = async (profileId: string) => {
    if (!confirm('Are you sure you want to delete this profile?')) return

    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', profileId)

    if (error) {
      console.error('Error deleting profile:', error)
      alert('Failed to delete profile')
    } else {
      onProfilesUpdate()
    }
  }

  const handleEditProfile = async (profileId: string) => {
    if (!editName || !editRate) return

    setLoading(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        name: editName,
        hourly_rate: parseFloat(editRate),
      } as any)
      .eq('id', profileId)

    if (error) {
      console.error('Error updating profile:', error)
      alert('Failed to update profile')
    } else {
      setEditingId(null)
      onProfilesUpdate()
    }
    setLoading(false)
  }

  const startEdit = (profile: Profile) => {
    setEditingId(profile.id)
    setEditName(profile.name)
    setEditRate(profile.hourly_rate.toString())
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
    setEditRate('')
  }

  return (
    <div className="profile-manager">
      {showPinVerify && (
        <PinVerifyModal 
          onSuccess={handlePinSuccess}
          onCancel={() => {
            setShowPinVerify(false)
            setPendingAction(null)
          }}
        />
      )}

      <h2>Profiles</h2>

      <div className="profiles-list">
        {profiles.map((profile) => (
          <div key={profile.id}>
            {editingId === profile.id ? (
              <div className="edit-profile-form">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Profile name"
                />
                <input
                  type="number"
                  step="0.01"
                  value={editRate}
                  onChange={(e) => setEditRate(e.target.value)}
                  placeholder="Hourly rate"
                />
                <div className="form-buttons">
                  <button 
                    onClick={() => handleEditProfile(profile.id)}
                    disabled={loading}
                  >
                    {loading ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={cancelEdit}>Cancel</button>
                </div>
              </div>
            ) : (
              <div 
                className={`profile-item ${activeProfile?.id === profile.id ? 'active' : ''}`}
                onClick={() => onProfileSelect(profile)}
              >
                <div className="profile-info">
                  <strong>{profile.name}</strong>
                  <span className="rate">${profile.hourly_rate}/hr</span>
                </div>
                <div className="profile-actions">
                  <button 
                    className="edit-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEditClick(profile)
                    }}
                  >
                    Edit
                  </button>
                  <button 
                    className="delete-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteClick(profile.id)
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {!isAdding ? (
        <button 
          className="add-profile-btn"
          onClick={handleAddClick}
        >
          + Add Profile
        </button>
      ) : (
        <form onSubmit={handleAddProfile} className="add-profile-form">
          <input
            type="text"
            placeholder="Profile name"
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            required
          />
          <input
            type="number"
            step="0.01"
            placeholder="Hourly rate"
            value={newProfileRate}
            onChange={(e) => setNewProfileRate(e.target.value)}
            required
          />
          <div className="form-buttons">
            <button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add'}
            </button>
            <button 
              type="button" 
              onClick={() => {
                setIsAdding(false)
                setNewProfileName('')
                setNewProfileRate('')
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
