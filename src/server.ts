import http from 'http'
import mysql from 'mysql2/promise'
import app from '@/app'
import { sequelize } from '@/config/database'
import { initSocketService } from '@/services/socket.service'
import { initCronJobs } from '@/services/cron.service'

const port = process.env.PORT || 3000
const server = http.createServer(app)

// Khởi tạo Socket.io Service
initSocketService(server)

// Database Connection & Server Boot
async function startServer() {
  try {
    const dbName = process.env.DB_NAME || 'phongthuy_simcathung'
    console.log(`Ensuring database "${dbName}" exists...`)
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    })
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`)
    await conn.end()
    console.log(`Database "${dbName}" is ready.`)

    await sequelize.authenticate()
    console.log('Database connection has been established successfully.')

    await sequelize.sync({ alter: true })
    console.log('Database synchronized.')

    initCronJobs()

    server.listen(port, () => {
      console.log(`Server is running on port ${port}`)
    })
  } catch (error) {
    console.error('Unable to connect to the database or start server:', error)
    process.exit(1)
  }
}

startServer()
