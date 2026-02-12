import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import type { Profile, TimeEntry } from '../types/database'
import { useUserRole } from '../hooks/useUserRole'
import ClockInOut from '../components/ClockInOut'
import ProfileSelector from '../components/ProfileSelector'
import TimeEntryList from '../components/TimeEntryList'
import PinSetupModal from '../components/PinSetupModal'
import './Dashboard.css'

export default function Dashboard() {
  const navigate = useNavigate()
  const { isAdmin, loading: roleLoading } = useUserRole()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null)
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showPinSetup, setShowPinSetup] = useState(false)
  const [hasPinSet, setHasPinSet] = useState(false)

  useEffect(() => {
    loadProfiles()
    checkPinStatus()
  }, [])

  useEffect(() => {
    if (activeProfile) {
      loadTimeEntries()
    }
  }, [activeProfile])

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
      setLoading(false)
    } else {
      setProfiles(data || [])
      if (data && data.length > 0) {
        setActiveProfile(data[0])
      } else {
        setTimeEntries([])
      }
      setLoading(false)
    }
  }

  const loadTimeEntries = async () => {
    if (!activeProfile) {
      setTimeEntries([])
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('profile_id', activeProfile.id)
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
          <ProfileSelector
            profiles={profiles}
            activeProfile={activeProfile}
            onProfileSelect={setActiveProfile}
            onProfilesUpdate={loadProfiles}
          />
          <ClockInOut 
            activeProfile={activeProfile}
            onUpdate={loadTimeEntries}
          />
          <TimeEntryList 
            timeEntries={timeEntries}
            profiles={profiles}
            isAdmin={isAdmin}
            onUpdate={loadTimeEntries}
            activeProfile={activeProfile}
          />
        </div>
      </div>
    </div>
  )
}
