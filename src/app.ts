import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import dotenv from 'dotenv'
import authRoutes from '@/routes/auth.routes'
import orderRoutes from '@/routes/order.routes'
import chatRoutes from '@/routes/chat.routes'
import fengshuiRoutes from '@/routes/fengshui.routes'
import adminRoutes from '@/routes/admin.routes'
import analyticsRoutes from '@/routes/analytics.routes'
import { errorHandler } from '@/middlewares/errorHandler'

dotenv.config()

const app = express()

// Middlewares
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}))
app.use(cookieParser())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() })
})

// Routes
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/orders', orderRoutes)
app.use('/api/v1/chats', chatRoutes)
app.use('/api/v1/fengshui', fengshuiRoutes)
app.use('/api/v1/analytics', analyticsRoutes)
app.use('/api/v1/admin', adminRoutes)

// Global Error Handler Middleware (Must be defined last)
app.use(errorHandler)

export default app
