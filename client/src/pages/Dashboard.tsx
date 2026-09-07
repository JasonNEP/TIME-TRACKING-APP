import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import type { Profile, TimeEntry } from '../types/database'
import { useUserRole } from '../hooks/useUserRole'
import ClockInOut from '../components/ClockInOut'
import ProfileSelector from '../components/ProfileSelector'
import TimeEntryList from '../components/TimeEntryList'
import PinSetupModal from '../components/PinSetupModal'
import './Dashboard.css'

type EntryViewMode = 'recent' | 'week' | 'range'

interface ProfileEntryViewPreference {
  mode: EntryViewMode
  entryLimit: number
}

interface EntryFilters {
  mode: EntryViewMode
  entryLimit: number
  startDate: string
  endDate: string
}

const ENTRY_PREFS_KEY = 'timeEntryViewPrefsByProfile'

export default function Dashboard() {
  const navigate = useNavigate()
  const { isAdmin, loading: roleLoading } = useUserRole()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null)
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [filters, setFilters] = useState<EntryFilters>({
    mode: 'recent',
    entryLimit: 10,
    startDate: '',
    endDate: '',
  })
  const [loading, setLoading] = useState(true)
  const [showPinSetup, setShowPinSetup] = useState(false)
  const [hasPinSet, setHasPinSet] = useState(false)
  const entriesRequestId = useRef(0)

  useEffect(() => {
    loadProfiles()
    checkPinStatus()
  }, [])

  useEffect(() => {
    if (!activeProfile) return

    const profilePrefs = getProfileViewPreference(activeProfile.id)
    const nextFilters: EntryFilters = {
      mode: profilePrefs?.mode || 'recent',
      entryLimit: profilePrefs?.entryLimit || 10,
      startDate: '',
      endDate: '',
    }

    setFilters(nextFilters)
    loadTimeEntries(activeProfile, nextFilters)
  }, [activeProfile])

  const getWeekRange = () => {
    const now = new Date()
    const day = now.getDay() // Sunday = 0

    const weekStart = new Date(now)
    weekStart.setHours(0, 0, 0, 0)
    weekStart.setDate(now.getDate() - day)

    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    return { weekStart, weekEnd }
  }

  const getProfileViewPreference = (profileId: string): ProfileEntryViewPreference | null => {
    try {
      const raw = localStorage.getItem(ENTRY_PREFS_KEY)
      if (!raw) return null
      const allPrefs = JSON.parse(raw) as Record<string, ProfileEntryViewPreference>
      return allPrefs[profileId] || null
    } catch (error) {
      console.error('Failed to read profile view preferences:', error)
      return null
    }
  }

  const saveProfileViewPreference = (profileId: string, preference: ProfileEntryViewPreference) => {
    try {
      const raw = localStorage.getItem(ENTRY_PREFS_KEY)
      const allPrefs = raw ? (JSON.parse(raw) as Record<string, ProfileEntryViewPreference>) : {}
      allPrefs[profileId] = preference
      localStorage.setItem(ENTRY_PREFS_KEY, JSON.stringify(allPrefs))
    } catch (error) {
      console.error('Failed to save profile view preferences:', error)
    }
  }

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
    if (!user) {
      setLoading(false)
      return
    }

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
      } else {
        setTimeEntries([])
      }
    }
    setLoading(false)
  }

  const applyEntryFilters = (entries: TimeEntry[], appliedFilters: EntryFilters) => {
    const withModeFilter = entries.filter((entry) => {
      const clockInMs = new Date(entry.clock_in).getTime()

      if (appliedFilters.mode === 'week') {
        const { weekStart, weekEnd } = getWeekRange()
        return clockInMs >= weekStart.getTime() && clockInMs <= weekEnd.getTime()
      }

      if (appliedFilters.mode === 'range') {
        if (appliedFilters.startDate) {
          const startMs = new Date(`${appliedFilters.startDate}T00:00:00`).getTime()
          if (clockInMs < startMs) return false
        }
        if (appliedFilters.endDate) {
          const endMs = new Date(`${appliedFilters.endDate}T23:59:59`).getTime()
          if (clockInMs > endMs) return false
        }
      }

      return true
    })

    if (appliedFilters.mode === 'recent') {
      return withModeFilter.slice(0, appliedFilters.entryLimit)
    }

    return withModeFilter
  }

  const loadTimeEntries = async (
    profileOverride: Profile | null = activeProfile,
    appliedFilters: EntryFilters = filters
  ) => {
    if (!profileOverride) {
      setTimeEntries([])
      return
    }

    const requestId = ++entriesRequestId.current

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let query = supabase
      .from('time_entries')
      .select('*, time_entry_segments(*)')
      .eq('user_id', user.id)
      .eq('profile_id', profileOverride.id)
      .order('clock_in', { ascending: false })
      .limit(1000)

    const { data, error } = await query

    if (error) {
      console.error('Error loading time entries:', error)
    } else {
      // Ignore out-of-order responses from older requests.
      if (requestId === entriesRequestId.current) {
        setTimeEntries(applyEntryFilters((data || []) as TimeEntry[], appliedFilters))
      }
    }
  }

  const handleRefresh = (nextFilters: EntryFilters) => {
    setFilters(nextFilters)
    loadTimeEntries(activeProfile, nextFilters)
  }

  const handleSaveViewAsDefault = (mode: EntryViewMode, entryLimit: number) => {
    if (!activeProfile) return
    saveProfileViewPreference(activeProfile.id, {
      mode,
      entryLimit,
    })
    alert(`Saved ${activeProfile.name} defaults`)
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
            onUpdate={() => loadTimeEntries(activeProfile, filters)}
          />
          <TimeEntryList 
            timeEntries={timeEntries}
            profiles={profiles}
            isAdmin={isAdmin}
            onUpdate={() => loadTimeEntries(activeProfile, filters)}
            onRefresh={handleRefresh}
            activeProfile={activeProfile}
            entryViewMode={filters.mode}
            entryLimit={filters.entryLimit}
            startDate={filters.startDate}
            endDate={filters.endDate}
            onSaveViewAsDefault={handleSaveViewAsDefault}
          />
        </div>
      </div>
    </div>
  )
}
