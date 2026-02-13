import { useState, useEffect } from 'react'
import type { Profile } from '../types/database'
import ProfileManager from './ProfileManager'
import './ProfileSelector.css'

interface ProfileSelectorProps {
  profiles: Profile[]
  activeProfile: Profile | null
  onProfileSelect: (profile: Profile) => void
  onProfilesUpdate: () => void
}

export default function ProfileSelector({ 
  profiles, 
  activeProfile, 
  onProfileSelect,
  onProfilesUpdate
}: ProfileSelectorProps) {
  const [showManageModal, setShowManageModal] = useState(false)
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

  return (
    <>
      <div className="profile-selector">
        <div className="profile-selector-content">
          <label htmlFor="profile-dropdown">Select Profile:</label>
          <select
            id="profile-dropdown"
            className="profile-dropdown"
            value={activeProfile?.id || ''}
            onChange={(e) => {
              const profile = profiles.find(p => p.id === e.target.value)
              if (profile) onProfileSelect(profile)
            }}
          >
            {profiles.length === 0 ? (
              <option value="">No profiles available</option>
            ) : (
              profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}{showRates ? ` - $${profile.hourly_rate}/hr` : ''}
                </option>
              ))
            )}
          </select>
          <button 
            className="manage-profiles-btn"
            onClick={() => setShowManageModal(true)}
          >
            Manage Profiles
          </button>
        </div>
      </div>

      {showManageModal && (
        <div className="modal-overlay" onClick={() => setShowManageModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Manage Profiles</h2>
              <button 
                className="close-modal-btn"
                onClick={() => setShowManageModal(false)}
              >
                ×
              </button>
            </div>
            <ProfileManager
              profiles={profiles}
              activeProfile={activeProfile}
              onProfilesUpdate={() => {
                onProfilesUpdate()
              }}
              onProfileSelect={onProfileSelect}
            />
          </div>
        </div>
      )}
    </>
  )
}
