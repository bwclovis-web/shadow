// Simple script to create UserAlert tables
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const prisma = new PrismaClient()

async function setup() {
  console.log('🚀 Setting up User Alerts System...\n')
  
  try {
    // Read the SQL file
    const sqlPath = join(__dirname, 'create-alert-tables.sql')
    const sql = readFileSync(sqlPath, 'utf-8')
    
    console.log('📋 Executing migration SQL...')
    
    // Execute the SQL
    await prisma.$executeRawUnsafe(sql)
    
    console.log('\n✅ Tables created successfully!')
    console.log('\n📊 Verifying...')
    
    // Verify by counting
    const alertCount = await prisma.userAlert.count()
    const prefCount = await prisma.userAlertPreferences.count()
    
    console.log(`   UserAlert: ${alertCount} records`)
    console.log(`   UserAlertPreferences: ${prefCount} records`)
    
    console.log('\n🎉 Setup complete!')
    console.log('\n📝 Next steps:')
    console.log('   1. Run: npx prisma generate')
    console.log('   2. Restart your dev server')
    console.log('   3. Visit your profile (e.g. /your-username/profile or /your-user-id/profile) to see your alerts\n')
    
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('✅ Tables already exist! No action needed.')
    } else {
      console.error('❌ Error:', error.message)
    }
  } finally {
    await prisma.$disconnect()
  }
}

setup()

