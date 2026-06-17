import fs from 'fs'
import path from 'path'
import mysql from 'mysql2/promise'
import { sequelize, Hexagram } from '@/models'

async function importHexagrams() {
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

    console.log('Starting hexagram import...')

    // Absolute paths to the source markdown files in api/src/data
    const originalFilePath = path.resolve(__dirname, '../data/Original_Dich_Thuat_80_Que (1).md')
    const cleanedFilePath = path.resolve(__dirname, '../data/Dich_Thuat_80_Que.md')

    if (!fs.existsSync(originalFilePath)) {
      throw new Error(`Original file not found at: ${originalFilePath}`)
    }
    if (!fs.existsSync(cleanedFilePath)) {
      throw new Error(`Cleaned file not found at: ${cleanedFilePath}`)
    }

    const originalContent = fs.readFileSync(originalFilePath, 'utf8')
    const cleanedContent = fs.readFileSync(cleanedFilePath, 'utf8')

    // 1. Parse Original Content
    // Split by "### Quẻ "
    const originalBlocks = originalContent.split('### Quẻ ')
    // Remove the first block (header/introduction)
    originalBlocks.shift()

    if (originalBlocks.length !== 80) {
      console.warn(`Warning: Expected 80 original blocks, but found ${originalBlocks.length}`)
    }

    // 2. Parse Cleaned Content
    // Split by "---"
    let cleanedBlocks = cleanedContent.split('\n---\n')
    // If it didn't match with newlines, try standard split
    if (cleanedBlocks.length < 10) {
      cleanedBlocks = cleanedContent.split('---')
    }
    
    // Filter out blocks that don't contain content (like intro headers)
    cleanedBlocks = cleanedBlocks.filter(block => block.trim().includes('Phân loại'))

    if (cleanedBlocks.length !== 80) {
      console.warn(`Warning: Expected 80 cleaned blocks, but found ${cleanedBlocks.length}`)
    }

    // Sync database tables. Only force drop if --force flag is provided.
    const isForce = process.argv.includes('--force')
    await sequelize.sync({ force: isForce })
    console.log(isForce ? 'Database synchronized with FORCE (all tables recreated).' : 'Database synchronized.')

    // Loop through 80 hexagrams
    for (let i = 0; i < 80; i++) {
      const origBlock = originalBlocks[i]
      const cleanBlock = cleanedBlocks[i]

      if (!origBlock) {
        console.error(`Missing original block for index ${i + 1}`)
        continue
      }

      // Parse ID and Name from the first line of the block
      // Example: "1: Vạn Tượng Khởi Thủy (Mọi hiện tượng bắt đầu sinh sôi)"
      const firstLineEnd = origBlock.indexOf('\n')
      const firstLine = origBlock.substring(0, firstLineEnd).trim()
      
      const matchHeader = firstLine.match(/^(\d+)[\s:-]+(.*)$/)
      const id = matchHeader ? parseInt(matchHeader[1], 10) : (i + 1)
      let name = matchHeader ? matchHeader[2].trim() : `Quẻ ${i + 1}`

      // Extract classification from original block
      // Example: "* **Phân loại**: **ĐẠI CÁT**"
      const classMatch = origBlock.match(/\*\s*\*\*Phân loại\*\*:\s*\*\*([^*]+)\*\*/)
      let classification = classMatch ? classMatch[1].trim() : 'CHƯA PHÂN LOẠI'
      
      // Normalize classification dash (replace en-dash with standard hyphen)
      classification = classification.replace(/–/g, '-').toUpperCase()

      // The full text of each block
      // Clean up headers and leading/trailing whitespace
      const originalText = `### Quẻ ${id}: ${name}\n` + origBlock.trim()
      const cleanedText = cleanBlock ? cleanBlock.trim() : ''

      // Upsert into Database
      await Hexagram.upsert({
        id,
        name,
        classification,
        originalText,
        cleanedText
      })

      console.log(`Imported Quẻ ${id}: ${name} [${classification}]`)
    }

    console.log('Import successfully completed!')
    process.exit(0)
  } catch (error) {
    console.error('Import failed:', error)
    process.exit(1)
  }
}

importHexagrams()
