import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import type { Profile, TimeEntry } from '../types/database'
import { useUserRole } from '../hooks/useUserRole'
import { usePinRequired } from '../hooks/usePinRequired'
import ClockInOut from '../components/ClockInOut'
import ProfileManager from '../components/ProfileManager'
import TimeEntryList from '../components/TimeEntryList'
import ManualEntry from '../components/ManualEntry'
import PinSetupModal from '../components/PinSetupModal'
import PinVerifyModal from '../components/PinVerifyModal'
import './Dashboard.css'

export default function Dashboard() {
  const navigate = useNavigate()
  const { isAdmin, loading: roleLoading } = useUserRole()
  const { pinRequired, refresh: refreshPinRequired } = usePinRequired()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null)
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showPinSetup, setShowPinSetup] = useState(false)
  const [hasPinSet, setHasPinSet] = useState(false)
  const [showPinVerifyForToggle, setShowPinVerifyForToggle] = useState(false)
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settingsMessage, setSettingsMessage] = useState('')

  useEffect(() => {
    loadProfiles()
    loadTimeEntries()
    checkPinStatus()
  }, [])

  const checkPinStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('user_roles')
      .select('pin_hash')
      .eq('user_id', user.id)
      .single()

    if (!error && data) {
      const pinIsSet = data.pin_hash !== null && data.pin_hash !== ''
      setHasPinSet(pinIsSet)
      if (!pinIsSet) {
        setShowPinSetup(true)
      }
    }
  }

  const loadProfiles = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading profiles:', error)
    } else {
      setProfiles(data || [])
      if (data && data.length > 0) {
        setActiveProfile(data[0])
      }
    }
    setLoading(false)
  }

  const loadTimeEntries = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('clock_in', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Error loading time entries:', error)
    } else {
      setTimeEntries(data || [])
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  const handleTogglePinRequirement = async () => {
    if (pinRequired) {
      // Turning OFF - require PIN verification first
      setShowPinVerifyForToggle(true)
    } else {
      // Turning ON - no verification needed
      await togglePinRequirement()
    }
  }

  const handlePinVerifiedForToggle = async () => {
    setShowPinVerifyForToggle(false)
    await togglePinRequirement()
  }

  const togglePinRequirement = async () => {
    setSettingsLoading(true)
    setSettingsMessage('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const newValue = !pinRequired

      const { error: updateError } = await supabase
        .from('user_roles')
        .update({ require_pin: newValue } as any)
        .eq('user_id', user.id)

      if (updateError) throw updateError

      await refreshPinRequired()
      setSettingsMessage(newValue ? 'PIN requirement enabled' : 'PIN requirement disabled')
      setTimeout(() => setSettingsMessage(''), 3000)
    } catch (err: any) {
      setSettingsMessage('Failed to update setting')
      setTimeout(() => setSettingsMessage(''), 3000)
    } finally {
      setSettingsLoading(false)
    }
  }

  if (loading || roleLoading) {
    return <div className="loading">Loading...</div>
  }

  return (
    <div className="dashboard">
      {showPinSetup && !hasPinSet && (
        <PinSetupModal 
          onSuccess={() => {
            setShowPinSetup(false)
            setHasPinSet(true)
          }}
        />
      )}

      {showPinVerifyForToggle && (
        <PinVerifyModal 
          onSuccess={handlePinVerifiedForToggle}
          onCancel={() => setShowPinVerifyForToggle(false)}
        />
      )}

      <header className="dashboard-header">
        <div className="header-left">
          <h1>Time Tracker</h1>
          {isAdmin && <span className="admin-badge">Admin</span>}
        </div>
        <nav className="header-nav">
          <button onClick={() => navigate('/dashboard')} className="nav-btn">
            Dashboard
          </button>
          <button onClick={() => navigate('/reports')} className="nav-btn">
            Reports
          </button>
          <button onClick={() => navigate('/settings')} className="nav-btn">
            Settings
          </button>
          <button onClick={handleSignOut} className="sign-out-btn">
            Sign Out
          </button>
        </nav>
      </header>

      <div className="dashboard-content">
        <div className="main-section">
          {isAdmin && (
            <div style={{
              background: 'white',
              padding: '1rem',
              borderRadius: '10px',
              marginBottom: '1rem',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Quick Settings</h3>
                {settingsMessage && (
                  <span style={{ 
                    color: settingsMessage.includes('Failed') ? '#c00' : '#060',
                    fontSize: '0.9rem',
                    fontWeight: 'bold'
                  }}>
                    {settingsMessage}
                  </span>
                )}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={pinRequired}
                  onChange={handleTogglePinRequirement}
                  disabled={settingsLoading}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.95rem' }}>
                  Require PIN for admin actions (edit, delete, manual entry)
                </span>
              </label>
              <p style={{ fontSize: '0.85rem', color: '#666', margin: '0.5rem 0 0 0', paddingLeft: '1.5rem' }}>
                {pinRequired 
                  ? '🔒 PIN required - admin actions will ask for verification'
                  : '🔓 PIN disabled - admin actions work without verification'
                }
              </p>
            </div>
          )}

          {isAdmin && (
            <ManualEntry 
              profiles={profiles}
              onUpdate={loadTimeEntries}
            />
          )}
          <ClockInOut 
            activeProfile={activeProfile}
            onUpdate={loadTimeEntries}
          />
          <TimeEntryList 
            timeEntries={timeEntries}
            profiles={profiles}
            isAdmin={isAdmin}
            onUpdate={loadTimeEntries}
          />
        </div>

        <div className="sidebar">
          <ProfileManager
            profiles={profiles}
            activeProfile={activeProfile}
            onProfilesUpdate={loadProfiles}
            onProfileSelect={setActiveProfile}
          />
        </div>
      </div>
    </div>
  )
}
