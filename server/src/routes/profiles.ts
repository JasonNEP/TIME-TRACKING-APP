import { Router } from 'express'
import { supabase } from '../config/supabase.js'

const router = Router()

// Get all profiles for a user
router.get('/', async (req, res) => {
  try {
    const userId = req.query.userId as string
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(data)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Get a single profile
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (error) throw error
    res.json(data)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Create a profile
router.post('/', async (req, res) => {
  try {
    const { user_id, name, hourly_rate } = req.body

    const { data, error } = await supabase
      .from('profiles')
      .insert({
        user_id,
        name,
        hourly_rate,
      })
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Update a profile
router.patch('/:id', async (req, res) => {
  try {
    const { name, hourly_rate } = req.body

    const { data, error } = await supabase
      .from('profiles')
      .update({
        name,
        hourly_rate,
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

// Delete a profile
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', req.params.id)

    if (error) throw error
    res.status(204).send()
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

export default router
