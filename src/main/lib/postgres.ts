import { exec } from 'child_process'
import { promisify } from 'util'
import { DatabaseConfig } from '../../shared/types'

const execAsync = promisify(exec)

let cachedPsqlPath: string | null = null

async function getPsqlPath(): Promise<string> {
  if (cachedPsqlPath) return cachedPsqlPath

  // 1. Try bare 'psql'
  try {
    await execAsync('psql --version')
    cachedPsqlPath = 'psql'
    return 'psql'
  } catch {
    // Continue to common paths
  }

  // 2. Check common Windows installation paths
  const commonPaths = [
    'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe',
    'C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe',
    'C:\\Program Files\\PostgreSQL\\15\\bin\\psql.exe'
  ]

  for (const path of commonPaths) {
    try {
      await execAsync(`"${path}" --version`)
      cachedPsqlPath = `"${path}"`
      return cachedPsqlPath
    } catch {
      continue
    }
  }

  throw new Error('PostgreSQL client (psql) not found locally. Please install the psql tool to use the "Connect" features, or configure your external database manually.')
}

async function runPsql(cmd: string, pass: string): Promise<{ stdout: string }> {
  try {
    const psqlPath = await getPsqlPath()
    // Replace the 'psql' placeholder in the cmd with the actual path
    const resolvedCmd = cmd.replace(/^psql/, psqlPath)
    
    return await execAsync(resolvedCmd, {
      env: { ...process.env, PGPASSWORD: pass }
    })
  } catch (error) {
    const msg = (error as Error).message
    if (msg.includes('psql') && (msg.includes('not found') || msg.includes('not recognized'))) {
      throw new Error('PostgreSQL client (psql) not found locally. Please install the psql tool to use the "Connect" features, or configure your external database manually.')
    }
    throw error
  }
}

export async function testPostgresConnection(config: DatabaseConfig): Promise<boolean> {
  try {
    const cmd = `psql -h ${config.host} -p ${config.port} -U ${config.user} -d postgres -t -c "SELECT 1"`
    // For cockroach, we might need 'defaultdb' instead of 'postgres'
    const dbName = config.host.includes('cockroach') ? 'defaultdb' : 'postgres'
    const finalCmd = cmd.replace('-d postgres', `-d ${dbName}`)
    
    await runPsql(finalCmd, config.pass)
    return true
  } catch (error) {
    if ((error as Error).message.includes('psql')) throw error
    console.error('Postgres connection test failed:', error)
    return false
  }
}

export async function listPostgreSQLDatabases(config: DatabaseConfig): Promise<string[]> {
  try {
    const dbName = config.host.includes('cockroach') ? 'defaultdb' : 'postgres'
    const cmd = `psql -h ${config.host} -p ${config.port} -U ${config.user} -d ${dbName} -t -c "SELECT datname FROM pg_database WHERE datistemplate = false;"`
    const { stdout } = await runPsql(cmd, config.pass)
    
    return stdout
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !['postgres', 'information_schema', 'pg_catalog', 'defaultdb'].includes(line))
  } catch (error) {
    if ((error as Error).message.includes('psql')) throw error
    console.error('Failed to list databases:', error)
    throw new Error('Could not list databases. Ensure Postgres is running and credentials are correct.')
  }
}

export async function createPostgreSQLDatabase(config: DatabaseConfig, name: string): Promise<void> {
  try {
    const dbName = config.host.includes('cockroach') ? 'defaultdb' : 'postgres'
    const cmd = `psql -h ${config.host} -p ${config.port} -U ${config.user} -d ${dbName} -c "CREATE DATABASE \\"${name}\\";"`
    await runPsql(cmd, config.pass)
  } catch (error) {
    if ((error as Error).message.includes('psql')) throw error
    console.error('Failed to create database:', error)
    throw new Error(`Failed to create database "${name}": ${(error as Error).message}`)
  }
}

export async function isDatabaseEmpty(config: DatabaseConfig): Promise<boolean> {
  try {
    // Check for any tables that are NOT in system schemas
    const cmd = `psql -h ${config.host} -p ${config.port} -U ${config.user} -d "${config.name}" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'crdb_internal');"`
    const { stdout } = await runPsql(cmd, config.pass)
    const count = parseInt(stdout.trim())
    return count === 0
  } catch (error) {
    console.error(`Failed to check if database "${config.name}" is empty:`, error)
    // If database doesn't exist, it's "empty" (or will be created)
    if (error instanceof Error && error.message.includes('does not exist')) return true
    return false // Assume not empty if check fails for other reasons
  }
}

export async function wipeDatabase(config: DatabaseConfig): Promise<void> {
  try {
    const defaultDb = config.host.includes('cockroach') ? 'defaultdb' : 'postgres'
    const dropCmd = `psql -h ${config.host} -p ${config.port} -U ${config.user} -d ${defaultDb} -c "DROP DATABASE IF EXISTS \\"${config.name}\\";"`
    const createCmd = `psql -h ${config.host} -p ${config.port} -U ${config.user} -d ${defaultDb} -c "CREATE DATABASE \\"${config.name}\\";"`
    
    await runPsql(dropCmd, config.pass)
    await runPsql(createCmd, config.pass)
  } catch (error) {
    console.error(`Failed to wipe database "${config.name}":`, error)
    throw new Error(`Failed to wipe database "${config.name}": ${(error as Error).message}`)
  }
}
