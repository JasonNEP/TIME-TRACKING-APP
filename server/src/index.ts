import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import timeEntriesRouter from './routes/timeEntries.js'
import profilesRouter from './routes/profiles.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(cors())
app.use(express.json())

// Routes
app.use('/api/time-entries', timeEntriesRouter)
app.use('/api/profiles', profilesRouter)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Time Tracker API is running' })
})

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
