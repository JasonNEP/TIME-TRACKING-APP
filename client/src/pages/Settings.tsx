import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import './Settings.css'

export default function Settings() {
  const navigate = useNavigate()
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmNewPin, setConfirmNewPin] = useState('')
  const [email, setEmail] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showResetForm, setShowResetForm] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [showDirectSet, setShowDirectSet] = useState(false)
  const [directPin, setDirectPin] = useState('')
  const [directConfirm, setDirectConfirm] = useState('')

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setError('PIN must be exactly 4 digits')
      return
    }

    if (newPin !== confirmNewPin) {
      setError('PINs do not match')
      return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Verify current PIN
      const { data, error: fetchError } = await supabase
        .from('user_roles')
        .select('pin_hash')
        .eq('user_id', user.id)
        .single()

      if (fetchError) throw fetchError
      if (!data) throw new Error('No user role found')

      const currentPinHash = await hashPin(currentPin)
      if (currentPinHash !== data.pin_hash) {
        setError('Current PIN is incorrect')
        setLoading(false)
        return
      }

      // Update to new PIN
      const newPinHash = await hashPin(newPin)
      const { error: updateError } = await supabase
        .from('user_roles')
        .update({ pin_hash: newPinHash } as any)
        .eq('user_id', user.id)

      if (updateError) throw updateError

      setSuccess('PIN changed successfully')
      setCurrentPin('')
      setNewPin('')
      setConfirmNewPin('')
    } catch (err: any) {
      setError(err.message || 'Failed to change PIN')
    } finally {
      setLoading(false)
    }
  }

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Generate random 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString()
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutes

      // Store reset code
      const { error: insertError } = await supabase
        .from('pin_reset_codes')
        .insert({
          user_id: user.id,
          code: code,
          expires_at: expiresAt,
          used: false
        } as any)

      if (insertError) throw insertError

      // Send email (placeholder - would need backend email service)
      console.log('Reset code:', code) // For demo, log it
      alert(`Reset code sent to your email. For demo purposes: ${code}`)

      setResetSent(true)
      setSuccess('Reset code sent to your email')
    } catch (err: any) {
      setError(err.message || 'Failed to send reset code')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setError('PIN must be exactly 4 digits')
      return
    }

    if (newPin !== confirmNewPin) {
      setError('PINs do not match')
      return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Verify reset code
      const { data: codes, error: fetchError } = await supabase
        .from('pin_reset_codes')
        .select('*')
        .eq('user_id', user.id)
        .eq('code', resetCode)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)

      if (fetchError) throw fetchError
      if (!codes || codes.length === 0) {
        setError('Invalid or expired reset code')
        setLoading(false)
        return
      }

      // Update PIN
      const newPinHash = await hashPin(newPin)
      const { error: updateError } = await supabase
        .from('user_roles')
        .update({ pin_hash: newPinHash } as any)
        .eq('user_id', user.id)

      if (updateError) throw updateError

      // Mark code as used
      await supabase
        .from('pin_reset_codes')
        .update({ used: true } as any)
        .eq('id', codes[0].id)

      setSuccess('PIN reset successfully')
      setShowResetForm(false)
      setResetSent(false)
      setResetCode('')
      setNewPin('')
      setConfirmNewPin('')
      setEmail('')
    } catch (err: any) {
      setError(err.message || 'Failed to reset PIN')
    } finally {
      setLoading(false)
    }
  }

  const handleDirectSetPin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (directPin.length !== 4 || !/^\d{4}$/.test(directPin)) {
      setError('PIN must be exactly 4 digits')
      return
    }

    if (directPin !== directConfirm) {
      setError('PINs do not match')
      return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const pinHash = await hashPin(directPin)
      console.log('Direct set PIN:', directPin)
      console.log('Direct set hash:', pinHash)

      const { error: updateError } = await supabase
        .from('user_roles')
        .update({ pin_hash: pinHash } as any)
        .eq('user_id', user.id)

      if (updateError) throw updateError

      setSuccess('PIN set successfully! Try using it now.')
      setShowDirectSet(false)
      setDirectPin('')
      setDirectConfirm('')
    } catch (err: any) {
      console.error('Direct set error:', err)
      setError(err.message || 'Failed to set PIN')
    } finally {
      setLoading(false)
    }
  }

  const hashPin = async (pin: string): Promise<string> => {
    const encoder = new TextEncoder()
    const data = encoder.encode(pin)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  return (
    <div className="settings-page">
      <div style={{ marginBottom: '1rem' }}>
        <button 
          onClick={() => navigate('/dashboard')}
          style={{
            padding: '0.5rem 1rem',
            background: '#f0f0f0',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          ← Back to Dashboard
        </button>
      </div>
      
      <h1>Settings</h1>

      <div className="settings-section">
        <h2>Change PIN</h2>
        <form onSubmit={handleChangePin}>
          <div className="form-group">
            <label>Current PIN:</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              required
            />
          </div>

          <div className="form-group">
            <label>New PIN:</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              required
            />
          </div>

          <div className="form-group">
            <label>Confirm New PIN:</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={confirmNewPin}
              onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              required
            />
          </div>

          <button type="submit" disabled={loading}>
            {loading ? 'Changing...' : 'Change PIN'}
          </button>
        </form>
      </div>

      <div className="settings-section" style={{ background: '#fff9e6', border: '2px solid #ffd700' }}>
        <h2>🔧 Quick PIN Setup (Troubleshooting)</h2>
        <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
          Use this if your PIN isn't working. This sets a new PIN without requiring the old one.
        </p>
        {!showDirectSet ? (
          <button onClick={() => setShowDirectSet(true)} className="secondary-btn">
            Set New PIN (Skip Verification)
          </button>
        ) : (
          <form onSubmit={handleDirectSetPin}>
            <div className="form-group">
              <label>New PIN:</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={directPin}
                onChange={(e) => setDirectPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>Confirm PIN:</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={directConfirm}
                onChange={(e) => setDirectConfirm(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                required
              />
            </div>

            <button type="submit" disabled={loading}>
              {loading ? 'Setting...' : 'Set PIN Now'}
            </button>
            <button 
              type="button" 
              onClick={() => setShowDirectSet(false)}
              className="cancel-btn"
            >
              Cancel
            </button>
          </form>
        )}
      </div>

      <div className="settings-section">
        <h2>Forgot PIN?</h2>
        {!showResetForm ? (
          <button onClick={() => setShowResetForm(true)} className="secondary-btn">
            Reset PIN via Email
          </button>
        ) : (
          <>
            {!resetSent ? (
              <form onSubmit={handleRequestReset}>
                <p>A reset code will be sent to your registered email</p>
                <button type="submit" disabled={loading}>
                  {loading ? 'Sending...' : 'Send Reset Code'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowResetForm(false)}
                  className="cancel-btn"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyReset}>
                <div className="form-group">
                  <label>Reset Code:</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>New PIN:</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Confirm New PIN:</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={confirmNewPin}
                    onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    required
                  />
                </div>

                <button type="submit" disabled={loading}>
                  {loading ? 'Resetting...' : 'Reset PIN'}
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowResetForm(false)
                    setResetSent(false)
                  }}
                  className="cancel-btn"
                >
                  Cancel
                </button>
              </form>
            )}
          </>
        )}
      </div>

      {error && <div className="settings-error">{error}</div>}
      {success && <div className="settings-success">{success}</div>}
    </div>
  )
}
