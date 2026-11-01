// Run a SQL file against the database: node scripts/run-sql.mjs supabase/migrations/0001_init.sql
// Needs SUPABASE_DB_URL in .env (Supabase dashboard > Connect > Session pooler).
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import pg from 'pg'

const file = process.argv[2]
if (!file) {
  console.error('usage: node scripts/run-sql.mjs <file.sql>')
  process.exit(1)
}
if (!process.env.SUPABASE_DB_URL) {
  console.error('SUPABASE_DB_URL is missing from .env')
  process.exit(1)
}

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})
await client.connect()
try {
  await client.query('begin')
  await client.query(readFileSync(file, 'utf8'))
  await client.query('commit')
  console.log(`applied ${file}`)
} catch (err) {
  await client.query('rollback')
  console.error(`failed ${file}: ${err.message}`)
  process.exitCode = 1
} finally {
  await client.end()
}
