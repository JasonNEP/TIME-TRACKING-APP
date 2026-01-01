import { Router } from 'express'
import { supabase } from '../config/supabase.js'

const router = Router()

// Get all time entries for a user
router.get('/', async (req, res) => {
  try {
    const userId = req.query.userId as string
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }

    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', userId)
      .order('clock_in', { ascending: false })

    if (error) throw error
    res.json(data)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Get a single time entry
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (error) throw error
    res.json(data)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Create a time entry (clock in)
router.post('/', async (req, res) => {
  try {
    const { user_id, profile_id, notes } = req.body

    const { data, error } = await supabase
      .from('time_entries')
      .insert({
        user_id,
        profile_id,
        clock_in: new Date().toISOString(),
        notes,
      })
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Update a time entry (clock out)
router.patch('/:id', async (req, res) => {
  try {
    const { clock_out, notes } = req.body

    const { data, error } = await supabase
      .from('time_entries')
      .update({
        clock_out: clock_out || new Date().toISOString(),
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Delete a time entry
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('time_entries')
      .delete()
      .eq('id', req.params.id)

    if (error) throw error
    res.status(204).send()
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

export default router
