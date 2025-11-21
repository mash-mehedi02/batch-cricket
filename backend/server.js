import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import tournamentsRouter from './routes/tournaments.js'
import squadsRouter from './routes/squads.js'
import playersRouter from './routes/players.js'
import matchesRouter from './routes/matches.js'
import matchStatusCron from './services/matchStatusCron.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5050
const HOST = process.env.HOST || '127.0.0.1'

const allowedOrigins = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || 'http://localhost:5173,http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const isLocalNetworkOrigin = (origin = '') => {
  return origin.startsWith('http://127.0.0.1') || origin.startsWith('http://192.168.') || origin.startsWith('http://10.')
    || origin.startsWith('https://127.0.0.1') || origin.startsWith('https://192.168.') || origin.startsWith('https://10.')
}

// Middleware
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || isLocalNetworkOrigin(origin)) {
      callback(null, true)
    } else {
      console.warn(`CORS blocked request from origin: ${origin}`)
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'School Cricket Management API is running',
    timestamp: new Date().toISOString(),
  })
})

// API Routes
app.use('/api/tournaments', tournamentsRouter)
app.use('/api/squads', squadsRouter)
app.use('/api/players', playersRouter)
app.use('/api/matches', matchesRouter)

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  })
})

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err)
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
  })
})

// Start server
app.listen(PORT, HOST, () => {
console.log(`🚀 Server running on http://${HOST}:${PORT}`)
console.log(`📡 API Health: http://${HOST}:${PORT}/health`)
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`)
  
  // Start match status cron job
  if (process.env.ENABLE_CRON !== 'false') {
    matchStatusCron.start()
  } else {
    console.log('⏸️ Cron job disabled (ENABLE_CRON=false)')
  }
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...')
  matchStatusCron.stop()
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...')
  matchStatusCron.stop()
  process.exit(0)
})

