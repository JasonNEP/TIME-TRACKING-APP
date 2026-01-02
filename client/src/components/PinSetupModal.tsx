import { useState } from 'react'
import { supabase } from '../services/supabase'
import './PinModal.css'

interface PinSetupModalProps {
  onSuccess: () => void
  onCancel?: () => void
}

export default function PinSetupModal({ onSuccess, onCancel }: PinSetupModalProps) {
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setError('PIN must be exactly 4 digits')
      return
    }

    if (pin !== confirmPin) {
      setError('PINs do not match')
      return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Hash the PIN (simple hash for demo - in production use bcrypt)
      const pinHash = await hashPin(pin)
      console.log('Setting PIN hash:', pinHash)
      console.log('Original PIN:', pin)

      const { error } = await supabase
        .from('user_roles')
        .update({ pin_hash: pinHash } as any)
        .eq('user_id', user.id)

      if (error) throw error

      console.log('PIN set successfully')
      onSuccess()
    } catch (err: any) {
      console.error('PIN setup error:', err)
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
    <div className="pin-modal-overlay">
      <div className="pin-modal">
        <h2>Set Your Admin PIN</h2>
        <p>Create a 4-digit PIN to secure administrative functions</p>
        
        <form onSubmit={handleSubmit}>
          <div className="pin-input-group">
            <label>Enter PIN:</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              autoFocus
              required
            />
          </div>

          <div className="pin-input-group">
            <label>Confirm PIN:</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              required
            />
          </div>

          {error && <div className="pin-error">{error}</div>}

          <div className="pin-modal-buttons">
            <button type="submit" disabled={loading}>
              {loading ? 'Setting PIN...' : 'Set PIN'}
            </button>
            {onCancel && (
              <button type="button" onClick={onCancel} className="cancel-btn">
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
