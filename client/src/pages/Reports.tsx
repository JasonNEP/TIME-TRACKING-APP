import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import type { Profile, TimeEntry } from '../types/database'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import './Reports.css'

interface ReportData {
  totalHours: number
  totalEarnings: number
  entries: TimeEntry[]
  entriesByProfile: {
    profile: Profile
    hours: number
    earnings: number
    entryCount: number
  }[]
}

export default function Reports() {
  const navigate = useNavigate()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [availableProfiles, setAvailableProfiles] = useState<Profile[]>([])
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>(['all'])

  useEffect(() => {
    loadProfiles()
  }, [])

  const loadProfiles = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)

    if (profiles) {
      setAvailableProfiles(profiles)
    }
  }

  const handleProfileToggle = (profileId: string) => {
    if (profileId === 'all') {
      setSelectedProfiles(['all'])
    } else {
      // Remove 'all' when selecting specific profiles
      let newSelected = selectedProfiles.filter(id => id !== 'all')
      
      if (newSelected.includes(profileId)) {
        // Uncheck this profile
        newSelected = newSelected.filter(id => id !== profileId)
        // If nothing selected, default back to 'all'
        setSelectedProfiles(newSelected.length === 0 ? ['all'] : newSelected)
      } else {
        // Check this profile
        setSelectedProfiles([...newSelected, profileId])
      }
    }
  }

  const generateReport = async () => {
    if (!startDate || !endDate) {
      alert('Please select both start and end dates')
      return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch time entries in date range
      const { data: entries, error: entriesError } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', user.id)
        .gte('clock_in', new Date(startDate).toISOString())
        .lte('clock_in', new Date(endDate + 'T23:59:59').toISOString())
        .not('clock_out', 'is', null)
        .order('clock_in', { ascending: false })

      if (entriesError) throw entriesError

      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)

      if (profilesError) throw profilesError

      // Calculate totals
      let totalHours = 0
      let totalEarnings = 0
      const profileMap = new Map<string, {
        profile: Profile
        hours: number
        earnings: number
        entryCount: number
      }>()

      entries?.forEach((entry: TimeEntry) => {
        if (!entry.clock_out) return

        const profile = profiles?.find(p => p.id === entry.profile_id)
        if (!profile) return

        // Filter by selected profiles
        if (!selectedProfiles.includes('all') && !selectedProfiles.includes(entry.profile_id)) {
          return
        }

        const hours = (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / (1000 * 60 * 60)
        const earnings = hours * profile.hourly_rate

        totalHours += hours
        totalEarnings += earnings

        if (!profileMap.has(profile.id)) {
          profileMap.set(profile.id, {
            profile,
            hours: 0,
            earnings: 0,
            entryCount: 0
          })
        }

        const profileData = profileMap.get(profile.id)!
        profileData.hours += hours
        profileData.earnings += earnings
        profileData.entryCount += 1
      })

      setReportData({
        totalHours,
        totalEarnings,
        entries: entries || [],
        entriesByProfile: Array.from(profileMap.values())
      })
    } catch (error: any) {
      console.error('Error generating report:', error)
      alert('Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  const exportToCSV = () => {
    if (!reportData) return

    let csv = 'Profile,Hours,Earnings,Entries\n'
    reportData.entriesByProfile.forEach(({ profile, hours, earnings, entryCount }) => {
      csv += `${profile.name},${hours.toFixed(2)},${earnings.toFixed(2)},${entryCount}\n`
    })
    csv += `\nTotal,${reportData.totalHours.toFixed(2)},${reportData.totalEarnings.toFixed(2)},${reportData.entriesByProfile.reduce((sum, p) => sum + p.entryCount, 0)}\n`

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `time-report-${startDate}-to-${endDate}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const exportToPDF = async () => {
    if (!reportData) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch profiles for lookup
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)

      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      
      // Title
      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      doc.text('Time Tracking Report', pageWidth / 2, 20, { align: 'center' })
      
      // Date range
      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.text(`${startDate} to ${endDate}`, pageWidth / 2, 28, { align: 'center' })
      
      // Summary section
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Summary', 14, 40)
      
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.text(`Total Hours: ${reportData.totalHours.toFixed(2)}`, 14, 48)
      doc.text(`Total Earnings: $${reportData.totalEarnings.toFixed(2)}`, 14, 55)
      doc.text(`Total Entries: ${reportData.entriesByProfile.reduce((sum, p) => sum + p.entryCount, 0)}`, 14, 62)
      
      // Profile breakdown table
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Breakdown by Profile', 14, 75)
      
      autoTable(doc, {
        startY: 80,
        head: [['Profile', 'Hours', 'Hourly Rate', 'Earnings', 'Entries']],
        body: reportData.entriesByProfile.map(({ profile, hours, earnings, entryCount }) => [
          profile.name,
          hours.toFixed(2),
          `$${profile.hourly_rate.toFixed(2)}`,
          `$${earnings.toFixed(2)}`,
          entryCount.toString()
        ]),
        theme: 'striped',
        headStyles: { fillColor: [102, 126, 234] },
        styles: { fontSize: 10 }
      })
      
      // Detailed entries section - continue on same page
      let currentY = (doc as any).lastAutoTable.finalY + 15
      
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Detailed Time Entries', 14, currentY)
      currentY += 5
      
      // Group entries by profile
      const entriesByProfileId = new Map<string, TimeEntry[]>()
      reportData.entries.forEach(entry => {
        if (!entriesByProfileId.has(entry.profile_id)) {
          entriesByProfileId.set(entry.profile_id, [])
        }
        entriesByProfileId.get(entry.profile_id)!.push(entry)
      })
      
      entriesByProfileId.forEach((entries, profileId) => {
        const profile = profiles?.find(p => p.id === profileId)
        if (!profile) return
        
        // Check if we need a new page
        if (currentY > 250) {
          doc.addPage()
          currentY = 20
        }
        
        // Profile header
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text(`Profile: ${profile.name} ($${profile.hourly_rate}/hr)`, 14, currentY)
        currentY += 5
        
        // Entries table for this profile
        const tableData = entries.map(entry => {
          const clockIn = new Date(entry.clock_in)
          const clockOut = entry.clock_out ? new Date(entry.clock_out) : null
          const hours = clockOut ? (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60) : 0
          const earnings = hours * profile.hourly_rate
          
          return [
            clockIn.toLocaleDateString(),
            clockIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            clockOut ? clockOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
            hours.toFixed(2),
            `$${earnings.toFixed(2)}`,
            entry.notes || '-'
          ]
        })
        
        autoTable(doc, {
          startY: currentY,
          head: [['Date', 'Clock In', 'Clock Out', 'Hours', 'Earnings', 'Notes']],
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [102, 126, 234], fontSize: 9 },
          styles: { fontSize: 8, cellPadding: 2 },
          columnStyles: {
            5: { cellWidth: 50 } // Notes column wider
          }
        })
        
        currentY = (doc as any).lastAutoTable.finalY + 10
      })
      
      // Save the PDF
      doc.save(`time-report-${startDate}-to-${endDate}.pdf`)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF. Make sure jspdf is installed.')
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className="reports-page">
      <header className="dashboard-header">
        <div className="header-left">
          <h1>Time Tracker - Reports</h1>
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

      <h1>Reports</h1>

      <div className="date-filters">
        <div className="date-input">
          <label>Start Date:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="date-input">
          <label>End Date:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <button onClick={generateReport} disabled={loading} className="generate-btn">
          {loading ? 'Generating...' : 'Generate Report'}
        </button>
      </div>

      {availableProfiles.length > 0 && (
        <div className="profile-filter">
          <h3>Filter by Profile:</h3>
          <div className="profile-checkboxes">
            <label className="profile-checkbox">
              <input
                type="checkbox"
                checked={selectedProfiles.includes('all')}
                onChange={() => handleProfileToggle('all')}
              />
              <span>All Profiles</span>
            </label>
            {availableProfiles.map(profile => (
              <label key={profile.id} className="profile-checkbox">
                <input
                  type="checkbox"
                  checked={selectedProfiles.includes('all') || selectedProfiles.includes(profile.id)}
                  onChange={() => handleProfileToggle(profile.id)}
                />
                <span>{profile.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {reportData && (
        <div className="report-results">
          <div className="report-summary">
            <div className="summary-card">
              <h3>Total Hours</h3>
              <p className="summary-value">{reportData.totalHours.toFixed(2)}</p>
            </div>
            <div className="summary-card">
              <h3>Total Earnings</h3>
              <p className="summary-value">${reportData.totalEarnings.toFixed(2)}</p>
            </div>
            <div className="summary-card">
              <h3>Total Entries</h3>
              <p className="summary-value">
                {reportData.entriesByProfile.reduce((sum, p) => sum + p.entryCount, 0)}
              </p>
            </div>
          </div>

          <div className="profile-breakdown">
            <h2>Breakdown by Profile</h2>
            <table>
              <thead>
                <tr>
                  <th>Profile</th>
                  <th>Hours</th>
                  <th>Earnings</th>
                  <th>Entries</th>
                </tr>
              </thead>
              <tbody>
                {reportData.entriesByProfile.map(({ profile, hours, earnings, entryCount }) => (
                  <tr key={profile.id}>
                    <td>{profile.name}</td>
                    <td>{hours.toFixed(2)}h</td>
                    <td>${earnings.toFixed(2)}</td>
                    <td>{entryCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="export-buttons">
            <button onClick={exportToCSV} className="export-btn">
              Export to CSV
            </button>
            <button onClick={exportToPDF} className="export-btn pdf-btn">
              Export to PDF
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
