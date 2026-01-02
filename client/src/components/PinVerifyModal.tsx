import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import './PinModal.css'

interface PinVerifyModalProps {
  onSuccess: () => void
  onCancel: () => void
}

export default function PinVerifyModal({ onSuccess, onCancel }: PinVerifyModalProps) {
  const navigate = useNavigate()
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (pin.length !== 4) {
      setError('PIN must be 4 digits')
      return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Get stored PIN hash
      const { data, error: fetchError } = await supabase
        .from('user_roles')
        .select('pin_hash')
        .eq('user_id', user.id)
        .single()

      if (fetchError) throw fetchError

      console.log('Stored PIN hash:', data.pin_hash)
      
      // Hash entered PIN and compare
      const pinHash = await hashPin(pin)
      console.log('Entered PIN hash:', pinHash)
      console.log('Match:', pinHash === data.pin_hash)
      
      if (pinHash === data.pin_hash) {
        onSuccess()
      } else {
        setError('Incorrect PIN. Check browser console for debug info.')
        setPin('')
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed')
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
        <h2>Enter Admin PIN</h2>
        <p>Enter your 4-digit PIN to continue</p>
        
        <form onSubmit={handleSubmit}>
          <div className="pin-input-group">
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

          {error && <div className="pin-error">{error}</div>}

          <div className="pin-modal-buttons">
            <button type="submit" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify'}
            </button>
            <button type="button" onClick={onCancel} className="cancel-btn">
              Cancel
            </button>
          </div>
          
          <dibutton 
              type="button"
              onClick={() => {
                onCancel()
                navigate('/settings')
              }}
              style={{ 
                background: 'none', 
                border: 'none', 
                color: '#667eea', 
                textDecoration: 'underline', 
                fontSize: '0.9rem',
                cursor: 'pointer',
                padding: 0
              }}
            >
              Forgot PIN?
            </buttonorgot PIN?
            </a>
          </div>
        </form>
      </div>
    </div>
  )
}
