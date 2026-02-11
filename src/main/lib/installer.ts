import { exec } from 'child_process'
import { promisify } from 'util'
import { join } from 'path'
import { BrowserWindow } from 'electron'
import * as fs from 'fs-extra'
// import { AppConfig } from '../../shared/types' // Import via absolute path or relative? 
// The shared folder is outside src/main in the file structure I envisioned? No, it's `src/shared`.
import { AppConfig, AVAILABLE_MODULES } from '../../shared/types'

const execAsync = promisify(exec)

export async function runInstaller(config: AppConfig, win: BrowserWindow): Promise<void> {
  const log = (message: string, type: 'info' | 'error' | 'success' = 'info'): void => {
    win.webContents.send('install-log', { message, type, timestamp: new Date().toLocaleTimeString() })
  }

  const runCommand = async (command: string, cwd: string): Promise<void> => {
    log(`Running: ${command}`, 'info')
    try {
      const { stdout } = await execAsync(command, { cwd })
      // Split output by lines and log each
      stdout.split('\n').forEach(line => {
        if (line.trim()) log(line.trim(), 'info')
      })
    } catch (error) {
      log(`Error running ${command}: ${(error as Error).message}`, 'error')
      throw error
    }
  }

  try {
    log('Starting installation...', 'info')
    
    // Ensure destination exists
    const projectRoot = join(config.destination, config.projectName)
    await fs.ensureDir(projectRoot)
    
    // 1. Clone API
    const apiPath = join(projectRoot, 'api')
    if (await fs.pathExists(apiPath)) {
       log('API directory already exists, skipping clone.', 'info')
    } else {
       log('Cloning API...', 'info')
       // In real usage, this URL should be configurable or fetched from a manifest
       await runCommand('git clone https://github.com/EvilInnocence-Studios/atp-api.git api', projectRoot)
    }

    // 2. Clone Admin
    const adminPath = join(projectRoot, 'admin')
     if (await fs.pathExists(adminPath)) {
       log('Admin directory already exists, skipping clone.', 'info')
    } else {
       log('Cloning Admin...', 'info')
       await runCommand('git clone https://github.com/EvilInnocence-Studios/atp-admin.git admin', projectRoot)
    }

    // 3. Clone Public
    const publicPath = join(projectRoot, 'public')
     if (await fs.pathExists(publicPath)) {
       log('Public directory already exists, skipping clone.', 'info')
    } else {
       log('Cloning Public...', 'info')
       await runCommand('git clone https://github.com/EvilInnocence-Studios/atp-public.git public', projectRoot)
    }


    // 4. Create package.custom.json
    const generateCustomJson = async (type: 'api' | 'admin' | 'public', targetPath: string): Promise<void> => {
       const customModules: Record<string, { repo: string, branch: string }> = {}
       
       // Always include the modules
       // We iterate over selected config modules
       for (const moduleId of config.modules) {
          const moduleDef = AVAILABLE_MODULES.find(m => m.id === moduleId)
          if (!moduleDef) continue

          const repos = moduleDef.repos[type] || []
          for (const repo of repos) {
             customModules[repo.repoName] = {
                repo: repo.url.match(/\/([^\/]+)\.git$/)?.[1] || repo.url,
                branch: repo.branch
             }
          }
       }

       await fs.writeFile(join(targetPath, 'package.custom.json'), JSON.stringify(customModules, null, 4))
    }

    log('Configuring modules...', 'info')
    await generateCustomJson('api', apiPath)
    await generateCustomJson('admin', adminPath)
    await generateCustomJson('public', publicPath)


    // 5. Create .env files
    log('Creating .env files...', 'info')
    const apiEnvContent = `
DB_HOST=${config.dbLocal.host}
DB_PORT=${config.dbLocal.port}
DB_USER=${config.dbLocal.user}
DB_PASSWORD=${config.dbLocal.pass}
DB_DATABASE=${config.dbLocal.name}
AWS_PROFILE=${config.awsProfile}
ADMIN_DOMAIN=${config.adminDomain}
PUBLIC_DOMAIN=${config.publicDomain}
API_DOMAIN=${config.apiDomain}
HOST_PUBLIC=http://${config.publicDomain}
HOST_ADMIN=http://${config.adminDomain}
HOST_API=http://${config.apiDomain}
ENV=local
DB_CLIENT=pg
DB_SSL=off
SALT=${config.advanced.SALT || ''}
SECRET=${config.advanced.SECRET || ''}
LAMBDA_FUNCTION_NAME=${config.advanced.LAMBDA_FUNCTION_NAME || ''}
LAMBDA_ROLE=${config.advanced.LAMBDA_ROLE || ''}
ACCOUNT=${config.advanced.ACCOUNT || ''}
S3BUCKET=${config.advanced.S3BUCKET || ''}
S3KEY=${config.advanced.S3KEY || ''}
CERTIFICATE_NAME=${config.advanced.CERTIFICATE_NAME || ''}
`
    await fs.writeFile(join(apiPath, '.env'), apiEnvContent)
    
    // Create .env.prod for API
    const apiEnvProdContent = `
DB_HOST=${config.dbProd.host}
DB_PORT=${config.dbProd.port}
DB_USER=${config.dbProd.user}
DB_PASSWORD=${config.dbProd.pass}
DB_DATABASE=${config.dbProd.name}
DB_CLIENT=pg
DB_SSL=true
ENV=prod
`
    await fs.writeFile(join(apiPath, '.env.prod'), apiEnvProdContent)

    // Admin .env
    const adminEnvContent = `
AWS_BUCKET=${config.advanced.AWS_BUCKET_ADMIN || ''}
CLOUDFRONT_DISTRIBUTION_ID=
`
    await fs.writeFile(join(adminPath, '.env'), adminEnvContent)

    // Public .env
    const publicEnvContent = `
AWS_BUCKET=${config.advanced.AWS_BUCKET_PUBLIC || ''}
API_URL=https://${config.apiDomain}
CLOUDFRONT_DISTRIBUTION_ID=
`
    await fs.writeFile(join(publicPath, '.env'), publicEnvContent)

    // 5b. Create config.local.ts for Admin and Public
    log('Creating config.local.ts...', 'info')
    const configLocalContent = `
export const localConfig = {
    api: {
        baseUrl: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
            ? 'http://localhost:3002/' 
            : 'https://${config.apiDomain}/'
    }
}
`
    await fs.ensureDir(join(adminPath, 'src'))
    await fs.writeFile(join(adminPath, 'src/config.local.ts'), configLocalContent)

    await fs.ensureDir(join(publicPath, 'src'))
    await fs.writeFile(join(publicPath, 'src/config.local.ts'), configLocalContent)

    // 6. Setup Databases
    log('Setting up databases...', 'info')
    
    // Local DB
    try {
      const { listPostgreSQLDatabases, createPostgreSQLDatabase } = await import('./postgres')
      const localDbs = await listPostgreSQLDatabases(config.dbLocal)
      if (!localDbs.includes(config.dbLocal.name)) {
        log(`Creating local database "${config.dbLocal.name}"...`, 'info')
        await createPostgreSQLDatabase(config.dbLocal, config.dbLocal.name)
      } else {
        log(`Local database "${config.dbLocal.name}" already exists.`, 'info')
      }
    } catch (dbError) {
      log(`Warning: Failed to ensure local database exists: ${(dbError as Error).message}`, 'info')
    }

    // Production DB (CockroachDB)
    if (config.advanced.COCKROACH_API_KEY && config.selectedClusterId) {
      try {
        const { listCockroachDatabases, createCockroachDatabase } = await import('./cockroach')
        const apiKey = config.advanced.COCKROACH_API_KEY
        const clusterId = config.selectedClusterId
        const prodDbs = await listCockroachDatabases(apiKey, clusterId)
        
        if (!prodDbs.includes(config.dbProd.name)) {
          log(`Creating production database "${config.dbProd.name}" on CockroachDB...`, 'info')
          await createCockroachDatabase(apiKey, clusterId, config.dbProd.name)
        } else {
          log(`Production database "${config.dbProd.name}" already exists.`, 'info')
        }
      } catch (dbError) {
        log(`Warning: Failed to ensure production database exists: ${(dbError as Error).message}`, 'info')
      }
    }

    // 7. Install Dependencies

    log('Installing API dependencies...', 'info')
    await runCommand('yarn install', apiPath)
    await runCommand('yarn install-custom', apiPath)

    log('Installing Admin dependencies...', 'info')
    await runCommand('yarn install', adminPath)
    await runCommand('yarn install-custom', adminPath)

    log('Installing Public dependencies...', 'info')
    await runCommand('yarn install', publicPath)
    await runCommand('yarn install-custom', publicPath)

    log('Setting up databases...', 'info')
    await runCommand('yarn setupDb --env=local --yes', apiPath)

    log('Installation Complete!', 'success')
    win.webContents.send('install-complete', true)

  } catch (error) {
    log(`Installation failed: ${(error as Error).message}`, 'error')
    win.webContents.send('install-complete', false)
  }
}

export async function deployToAws(config: AppConfig, win: BrowserWindow): Promise<void> {

  const log = (message: string, type: 'info' | 'error' | 'success' = 'info'): void => {
    win.webContents.send('install-log', { message, type })
  }

  const runCommand = async (command: string, cwd: string): Promise<void> => {
    log(`Running: ${command}`, 'info')
    try {
      const { stdout } = await execAsync(command, { cwd })
      stdout.split('\n').forEach(line => {
        if (line.trim()) log(line.trim(), 'info')
      })
    } catch (error) {
       log(`Error running ${command}: ${(error as Error).message}`, 'error')
       throw error
    }
  }

  try {
    log('Starting deployment...', 'info')
    
    const projectRoot = join(config.destination, config.projectName)
    const apiPath = join(projectRoot, 'api')
    const adminPath = join(projectRoot, 'admin')
    const publicPath = join(projectRoot, 'public')


    log('Deploying API...', 'info')
    await runCommand('yarn full-deploy', apiPath)

    log('Deploying Admin...', 'info')
    await runCommand('yarn deploy', adminPath)

    log('Deploying Public...', 'info')
    await runCommand('yarn deploy', publicPath)

    log('Deployment Complete!', 'success')
    win.webContents.send('deploy-complete', true)

  } catch (error) {
    log(`Deployment failed: ${(error as Error).message}`, 'error')
    win.webContents.send('deploy-complete', false)
  }
}

