import { exec } from 'child_process'
import { promisify } from 'util'
import { join } from 'path'
import { BrowserWindow } from 'electron'
import * as fs from 'fs-extra'
// import { AppConfig } from '../../shared/types' // Import via absolute path or relative? 
// The shared folder is outside src/main in the file structure I envisioned? No, it's `src/shared`.
import { AppConfig, AVAILABLE_MODULES, MigrationStatus } from '../../shared/types'

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
    const apiEnvContent = `ENV=local
HOST_PUBLIC=http://localhost:3000
HOST_ADMIN=http://localhost:3001
HOST_API=http://localhost:3002
DB_CLIENT=pg
DB_HOST=${config.dbLocal.host}
DB_PORT=${config.dbLocal.port}
DB_USER=${config.dbLocal.user}
DB_PASSWORD='${config.dbLocal.pass}'
DB_DATABASE=${config.dbLocal.name}
DB_SSL=off
SALT=${config.advanced.SALT || ''}
SECRET=${config.advanced.SECRET || ''}
AWS_PROFILE=${config.awsProfile}
AWS_REGION=${config.awsRegion}
AWS_DEFAULT_REGION=${config.awsRegion}
AWS_ACCESS_KEY_ID=${config.advanced.AWS_ACCESS_KEY_ID || ''}
AWS_SECRET_ACCESS_KEY=${config.advanced.AWS_SECRET_ACCESS_KEY || ''}
LAMBDA_FUNCTION_NAME=${config.advanced.LAMBDA_FUNCTION_NAME || ''}
LAMBDA_ROLE=${config.advanced.LAMBDA_ROLE || ''}
ACCOUNT=${config.advanced.ACCOUNT || ''}
S3BUCKET=${config.advanced.S3BUCKET || ''}
S3KEY=${config.advanced.S3KEY || ''}
CERTIFICATE_NAME=${config.advanced.CERTIFICATE_NAME || ''}
ALTERNATE_DOMAIN_NAME=${config.apiDomain}
CLOUDFRONT_DISTRIBUTION_ID=${config.advanced.CLOUDFRONT_DISTRIBUTION_ID_API || ''}
`
    await fs.writeFile(join(apiPath, '.env'), apiEnvContent)
    
    // Create .env.prod for API
    const apiEnvProdContent = `ENV=prod
HOST_PUBLIC=https://${config.publicDomain}
HOST_ADMIN=https://${config.adminDomain}
HOST_API=https://${config.apiDomain}
DB_CLIENT=cockroachdb
DB_HOST=${config.dbProd.host}
DB_PORT=${config.dbProd.port}
DB_USER=${config.dbProd.user}
DB_PASSWORD='${config.dbProd.pass}'
DB_DATABASE=${config.dbProd.name}
DB_SSL=on
SALT=${config.advanced.SALT || ''}
SECRET=${config.advanced.SECRET || ''}
AWS_REGION=${config.awsRegion}
AWS_DEFAULT_REGION=${config.awsRegion}
AWS_ACCESS_KEY_ID=${config.advanced.AWS_ACCESS_KEY_ID || ''}
AWS_SECRET_ACCESS_KEY=${config.advanced.AWS_SECRET_ACCESS_KEY || ''}
ALTERNATE_DOMAIN_NAME=${config.apiDomain}
CLOUDFRONT_DISTRIBUTION_ID=${config.advanced.CLOUDFRONT_DISTRIBUTION_ID_API || ''}
`
    await fs.writeFile(join(apiPath, '.env.prod'), apiEnvProdContent)

    // Admin .env
    const adminEnvContent = `AWS_BUCKET=${config.advanced.AWS_BUCKET_ADMIN || ''}
CLOUDFRONT_DISTRIBUTION_ID=${config.advanced.CLOUDFRONT_DISTRIBUTION_ID_ADMIN || ''}
`
    await fs.writeFile(join(adminPath, '.env'), adminEnvContent)

    // Public .env
    const publicEnvContent = `AWS_BUCKET=${config.advanced.AWS_BUCKET_PUBLIC || ''}
API_URL=https://${config.apiDomain}/
CLOUDFRONT_DISTRIBUTION_ID=${config.advanced.CLOUDFRONT_DISTRIBUTION_ID_PUBLIC || ''}
`
    await fs.writeFile(join(publicPath, '.env'), publicEnvContent)

    // 5b. Create config.local.ts for Admin and Public
    log('Creating config.local.ts...', 'info')
    const configLocalContent = `export const localConfig = {
    api: {
        baseUrl: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
            ? 'http://localhost:3002/' 
            : 'https://${config.apiDomain}/'
    },
    paypal: {
        plans: []
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
    await runCommand('yarn build', apiPath)

    log('Installing Admin dependencies...', 'info')
    await runCommand('yarn install', adminPath)
    await runCommand('yarn install-custom', adminPath)

    log('Installing Public dependencies...', 'info')
    await runCommand('yarn install', publicPath)
    await runCommand('yarn install-custom', publicPath)

    // log('Setting up databases...', 'info')
    // await runCommand('yarn setupDb --env=local --yes', apiPath)

    log('Installation Complete!', 'success')
    win.webContents.send('install-complete', true)

  } catch (error) {
    log(`Installation failed: ${(error as Error).message}`, 'error')
    win.webContents.send('install-complete', false)
  }
}

export async function deployToAws(config: AppConfig, win: BrowserWindow, target: 'api' | 'admin' | 'public' | 'all' = 'all'): Promise<void> {

  const log = (message: string, type: 'info' | 'error' | 'success' = 'info'): void => {
    win.webContents.send('install-log', { message, type })
  }

  const runCommand = async (command: string, cwd: string): Promise<string> => {
    log(`Running: ${command}`, 'info')
    try {
      const { stdout } = await execAsync(command, { cwd })
      stdout.split('\n').forEach(line => {
        if (line.trim()) log(line.trim(), 'info')
      })
      return stdout
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

    log('Ensuring AWS resources exist...', 'info')
    const { ensureS3Bucket, ensureLambdaRole, ensureCertificate } = await import('./aws-init')
    const options = { profile: config.awsProfile, region: config.awsRegion }

    if (config.advanced.S3BUCKET) {
      log(`Checking S3 Bucket: ${config.advanced.S3BUCKET}...`, 'info')
      await ensureS3Bucket(config.advanced.S3BUCKET, options)
    }
    if (config.advanced.AWS_BUCKET_ADMIN) {
      log(`Checking S3 Bucket (Admin): ${config.advanced.AWS_BUCKET_ADMIN}...`, 'info')
      await ensureS3Bucket(config.advanced.AWS_BUCKET_ADMIN, options)
    }
    if (config.advanced.AWS_BUCKET_PUBLIC) {
      log(`Checking S3 Bucket (Public): ${config.advanced.AWS_BUCKET_PUBLIC}...`, 'info')
      await ensureS3Bucket(config.advanced.AWS_BUCKET_PUBLIC, options)
    }
    if (config.advanced.LAMBDA_ROLE) {
      log(`Checking IAM Role: ${config.advanced.LAMBDA_ROLE}...`, 'info')
      await ensureLambdaRole(config.advanced.LAMBDA_ROLE, options)
    }
    if (config.advanced.CERTIFICATE_NAME) {
      log(`Checking SSL Certificate: ${config.advanced.CERTIFICATE_NAME}...`, 'info')
      await ensureCertificate(config.advanced.CERTIFICATE_NAME, options)
    }


    if (target === 'all' || target === 'api') {
      log('Deploying API...', 'info')
      const stdout = await runCommand('yarn full-deploy', apiPath)
      
      // Parse for LAMBDA_URL
      const match = stdout.match(/LAMBDA_URL=(.*)/)
      if (match && match[1]) {
        const fullUrl = match[1].trim()
        const urlHost = fullUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
        log(`Captured Lambda URL: ${fullUrl}`, 'info')
        log(`Updating CF_ORIGIN_DOMAIN_NAME to: ${urlHost}`, 'info')

        // Update .env files
        const envFiles = ['.env', '.env.prod']
        for (const file of envFiles) {
          const envPath = join(apiPath, file)
          if (await fs.pathExists(envPath)) {
            let content = await fs.readFile(envPath, 'utf-8')
            if (content.includes('CF_ORIGIN_DOMAIN_NAME=')) {
              content = content.replace(/CF_ORIGIN_DOMAIN_NAME=.*/, `CF_ORIGIN_DOMAIN_NAME=${urlHost}`)
            } else if (content.includes('ORIGIN_DOMAIN_NAME=')) {
               content = content.replace(/ORIGIN_DOMAIN_NAME=.*/, `ORIGIN_DOMAIN_NAME=${urlHost}`)
            } else {
              content += `\nCF_ORIGIN_DOMAIN_NAME=${urlHost}\n`
            }
            await fs.writeFile(envPath, content)
            log(`Updated ${file} with new origin domain name.`, 'info')
          }
        }
      }
    }

    if (target === 'all' || target === 'admin') {
      log('Deploying Admin...', 'info')
      await runCommand('yarn deploy', adminPath)
    }

    if (target === 'all' || target === 'public') {
      log('Deploying Public...', 'info')
      await runCommand('yarn deploy', publicPath)
    }

    log('Deployment Complete!', 'success')
    win.webContents.send('deploy-complete', true)

  } catch (error) {
    log(`Deployment failed: ${(error as Error).message}`, 'error')
    win.webContents.send('deploy-complete', false)
  }
}

const parseEnv = (content: string): Record<string, string> => {
  return content.split('\n').reduce((acc, line) => {
    // Basic parser for KEY=VALUE
    const cleanLine = line.trim()
    if (!cleanLine || cleanLine.startsWith('#')) return acc
    
    const parts = cleanLine.split('=')
    if (parts.length < 2) return acc

    const key = parts[0].trim()
    let value = parts.slice(1).join('=').trim()

    // Remove quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
       value = value.slice(1, -1)
    }

    acc[key] = value
    return acc
  }, {} as Record<string, string>)
}

export async function updateProjectModules(config: AppConfig, newModules: string[], win: BrowserWindow): Promise<void> {
  const log = (message: string, type: 'info' | 'error' | 'success' = 'info'): void => {
    win.webContents.send('install-log', { message, type })
  }

  try {
    log(`Syncing modules...`, 'info')
    
    const projectRoot = join(config.destination, config.projectName)
    const projects: ('api' | 'admin' | 'public')[] = ['api', 'admin', 'public']
    
    const oldModules = config.modules
    const added = newModules.filter(m => !oldModules.includes(m))
    const removed = oldModules.filter(m => !newModules.includes(m))

    // 1. Process Removals
    for (const modId of removed) {
      const moduleDef = AVAILABLE_MODULES.find(m => m.id === modId)
      if (!moduleDef) continue

      log(`Removing module: ${moduleDef.name}...`, 'info')
      
      for (const project of projects) {
        const projectPath = join(projectRoot, project)
        const customJsonPath = join(projectPath, 'package.custom.json')
        
        if (await fs.pathExists(customJsonPath)) {
          const customJson = await fs.readJson(customJsonPath)
          const repos = moduleDef.repos[project] || []
          
          for (const repo of repos) {
            delete customJson[repo.repoName]
            const repoPath = join(projectPath, 'src', repo.repoName)
            if (await fs.pathExists(repoPath)) {
              log(`Deleting directory: ${project}/src/${repo.repoName}`, 'info')
              await fs.remove(repoPath)
            }
          }
          await fs.writeJson(customJsonPath, customJson, { spaces: 4 })
        }
      }
    }

    // 2. Process Additions
    for (const modId of added) {
      const moduleDef = AVAILABLE_MODULES.find(m => m.id === modId)
      if (!moduleDef) continue

      log(`Adding module: ${moduleDef.name}...`, 'info')
      
      for (const project of projects) {
        const projectPath = join(projectRoot, project)
        const customJsonPath = join(projectPath, 'package.custom.json')
        
        if (await fs.pathExists(customJsonPath)) {
          const customJson = await fs.readJson(customJsonPath)
          const repos = moduleDef.repos[project] || []
          
          for (const repo of repos) {
            // "https://github.com/EvilInnocence-Studios/atp-core-api.git" -> "atp-core-api"
            const repoNameOnly = repo.url.split('/').pop()?.replace('.git', '') || ''
            customJson[repo.repoName] = { 
              repo: repoNameOnly, 
              branch: repo.branch 
            }
          }
          await fs.writeJson(customJsonPath, customJson, { spaces: 4 })
        }
      }
    }

    // 3. Run install-custom
    for (const project of projects) {
      const projectPath = join(projectRoot, project)
      log(`Running yarn install-custom for ${project}...`, 'info')
      try {
        const { stdout } = await execAsync('yarn install-custom', { cwd: projectPath })
        stdout.split('\n').forEach(line => line.trim() && log(line.trim(), 'info'))
      } catch (err) {
        log(`Warning: yarn install-custom failed for ${project}: ${(err as Error).message}`, 'error')
      }
    }

    // 4. Update config file
    const newConfig = { ...config, modules: newModules }
    const configPath = join(config.destination, config.projectName, '.gemini', 'installer-config.json')
    await fs.writeJson(configPath, newConfig, { spaces: 2 })

    log('Module sync complete!', 'success')
    win.webContents.send('project-config-updated', newConfig)
    win.webContents.send('module-sync-complete', true)

  } catch (error) {
    log(`Module sync failed: ${(error as Error).message}`, 'error')
    win.webContents.send('module-sync-complete', false)
    throw error
  }
}

export async function loadProjectConfig(projectPath: string): Promise<Partial<AppConfig>> {
  try {
     const apiPath = join(projectPath, 'api')
     const adminPath = join(projectPath, 'admin')
     const publicPath = join(projectPath, 'public')

     const apiEnv = await fs.readFile(join(apiPath, '.env'), 'utf-8').then(parseEnv).catch(() => ({} as Record<string, string>))
     const apiEnvProd = await fs.readFile(join(apiPath, '.env.prod'), 'utf-8').then(parseEnv).catch(() => ({} as Record<string, string>))
     const adminEnv = await fs.readFile(join(adminPath, '.env'), 'utf-8').then(parseEnv).catch((e) => {
         console.warn('Failed to read admin .env', e); return {} as Record<string, string>
     })
     const publicEnv = await fs.readFile(join(publicPath, '.env'), 'utf-8').then(parseEnv).catch((e) => {
         console.warn('Failed to read public .env', e); return {} as Record<string, string>
     })

     const modules: string[] = ['core', 'admin', 'public'] // Defaults
     try {
       const customJson = await fs.readJson(join(apiPath, 'package.custom.json'))
       for (const mod of AVAILABLE_MODULES) {
          if (mod.id === 'core') continue
          const apiRepos = mod.repos.api || []
          if (apiRepos.some(r => customJson[r.repoName])) {
             modules.push(mod.id)
          }
       }
     } catch (e) {
       console.warn('Failed to read package.custom.json', e)
     }

     const uniqueModules = Array.from(new Set(modules))

     const cleanDomain = (val?: string) => {
        if (!val) return ''
        return val.replace(/^https?:\/\//, '').replace(/\/$/, '')
     }

     const config: Partial<AppConfig> = {
        projectName: require('path').basename(projectPath),
        destination: require('path').dirname(projectPath),
        adminDomain: cleanDomain(apiEnvProd['HOST_ADMIN']) || apiEnv['ADMIN_DOMAIN'] || '',
        publicDomain: cleanDomain(apiEnvProd['HOST_PUBLIC']) || apiEnv['PUBLIC_DOMAIN'] || '',
        apiDomain: cleanDomain(apiEnvProd['HOST_API']) || apiEnv['API_DOMAIN'] || '',
        modules: uniqueModules,
        awsProfile: apiEnv['AWS_PROFILE'] || 'default',
        awsRegion: 'us-east-1',
        
        dbLocal: {
          host: apiEnv['DB_HOST'] || 'localhost',
          port: parseInt(apiEnv['DB_PORT'] || '5432'),
          user: apiEnv['DB_USER'] || 'postgres',
          pass: apiEnv['DB_PASSWORD'] || apiEnv['DB_PASS'] || '',
          name: apiEnv['DB_DATABASE'] || apiEnv['DB_NAME'] || ''
        },
        dbProd: {
          host: apiEnvProd['DB_HOST'] || '',
          port: parseInt(apiEnvProd['DB_PORT'] || '26257'),
          user: apiEnvProd['DB_USER'] || '',
          pass: apiEnvProd['DB_PASSWORD'] || apiEnvProd['DB_PASS'] || '',
          name: apiEnvProd['DB_DATABASE'] || apiEnvProd['DB_NAME'] || ''
        },
        selectedClusterId: null,
        advanced: {
           SALT: apiEnv['SALT'] || '',
           SECRET: apiEnv['SECRET'] || '',
           LAMBDA_FUNCTION_NAME: apiEnv['LAMBDA_FUNCTION_NAME'] || '',
           LAMBDA_ROLE: apiEnv['LAMBDA_ROLE'] || '',
           ACCOUNT: apiEnv['ACCOUNT'] || '',
           S3BUCKET: apiEnv['S3BUCKET'] || '',
           S3KEY: apiEnv['S3KEY'] || '',
            CERTIFICATE_NAME: apiEnv['CERTIFICATE_NAME'] || '',
            ORIGIN_DOMAIN_NAME: apiEnv['ORIGIN_DOMAIN_NAME'] || apiEnv['CF_ORIGIN_DOMAIN_NAME'] || apiEnvProd['ORIGIN_DOMAIN_NAME'] || apiEnvProd['CF_ORIGIN_DOMAIN_NAME'] || '',
            ALTERNATE_DOMAIN_NAMES: apiEnv['ALTERNATE_DOMAIN_NAMES'] || apiEnv['ALTERNATE_DOMAIN_NAME'] || apiEnvProd['ALTERNATE_DOMAIN_NAMES'] || apiEnvProd['ALTERNATE_DOMAIN_NAME'] || '',
            AWS_BUCKET_ADMIN: adminEnv['AWS_BUCKET'] || '',
            AWS_BUCKET_PUBLIC: publicEnv['AWS_BUCKET'] || '',
            CLOUDFRONT_DISTRIBUTION_ID_API: apiEnv['CLOUDFRONT_DISTRIBUTION_ID'] || apiEnvProd['CLOUDFRONT_DISTRIBUTION_ID'] || '',
            CLOUDFRONT_DISTRIBUTION_ID_ADMIN: adminEnv['CLOUDFRONT_DISTRIBUTION_ID'] || '',
            CLOUDFRONT_DISTRIBUTION_ID_PUBLIC: publicEnv['CLOUDFRONT_DISTRIBUTION_ID'] || ''
        }
     }

     return config
  } catch (error) {
     console.error('Failed to load project config:', error)
     throw error
  }
}

import { AwsResourceStatus } from '../../shared/types'

export async function checkAwsStatus(config: AppConfig, win: BrowserWindow): Promise<void> {
  const profile = config.awsProfile
  const region = config.awsRegion
  
  const runAws = async (cmd: string): Promise<any> => {
     try {
       const { stdout } = await execAsync(`aws ${cmd} --profile ${profile} --region ${region} --output json`)
       return JSON.parse(stdout)
     } catch (e: any) {
       // Re-throw
       throw e
     }
  }

  // Define all checks
  const checks: { type: AwsResourceStatus['type'], name: string, id: string, desc: string, run: () => Promise<AwsResourceStatus> }[] = []

  // S3
  const buckets = [
     { key: 'S3BUCKET', name: config.advanced.S3BUCKET, desc: 'Deployment Bucket' },
     { key: 'AWS_BUCKET_ADMIN', name: config.advanced.AWS_BUCKET_ADMIN, desc: 'Admin Site Bucket' },
     { key: 'AWS_BUCKET_PUBLIC', name: config.advanced.AWS_BUCKET_PUBLIC, desc: 'Public Site Bucket' }
  ]
  buckets.forEach(b => {
      checks.push({
          type: 'S3', name: b.desc, id: b.name || 'Not Configured', desc: b.desc,
          run: async () => {
              if (!b.name) return { name: b.desc, type: 'S3', id: 'Not Configured', status: 'Missing' }
              try {
                  await runAws(`s3api head-bucket --bucket ${b.name}`)
                  return { name: b.desc, type: 'S3', id: b.name, status: 'Exists' }
              } catch (e: any) {
                  return { name: b.desc, type: 'S3', id: b.name, status: 'Missing' }
              }
          }
      })
  })

  // IAM Role
  const roleName = config.advanced.LAMBDA_ROLE
  checks.push({
      type: 'IAM Role', name: 'Lambda Role', id: roleName || 'Not Configured', desc: 'Lambda Role',
      run: async () => {
          if (!roleName) return { name: 'Lambda Role', type: 'IAM Role', id: 'Not Configured', status: 'Missing' }
          try {
              await runAws(`iam get-role --role-name ${roleName}`)
              return { name: 'Lambda Role', type: 'IAM Role', id: roleName, status: 'Exists' }
          } catch (e: any) {
              return { name: 'Lambda Role', type: 'IAM Role', id: roleName, status: 'Missing' }
          }
      }
  })

  // Lambda
  const lambdaName = config.advanced.LAMBDA_FUNCTION_NAME
  checks.push({
      type: 'Lambda', name: 'API Lambda', id: lambdaName || 'Not Configured', desc: 'API Lambda',
      run: async () => {
          if (!lambdaName) return { name: 'API Lambda', type: 'Lambda', id: 'Not Configured', status: 'Missing' }
          try {
              const res = await runAws(`lambda get-function --function-name ${lambdaName}`)
              return { name: 'API Lambda', type: 'Lambda', id: lambdaName, status: 'Exists', details: res.Configuration?.State }
          } catch (e: any) {
              return { name: 'API Lambda', type: 'Lambda', id: lambdaName, status: 'Missing' }
          }
      }
  })

  // Certificate
  const certName = config.advanced.CERTIFICATE_NAME
  checks.push({
      type: 'Certificate', name: 'SSL Certificate', id: certName || 'Not Configured', desc: 'SSL Certificate',
      run: async () => {
           if (!certName) return { name: 'SSL Certificate', type: 'Certificate', id: 'Not Configured', status: 'Missing' }
           try {
              // List certificates since we don't have ARN
              const res = await runAws(`acm list-certificates`)
              const cert = res.CertificateSummaryList?.find((c: any) => c.DomainName === certName)
              if (cert) {
                 // Get more details including validation records
                 try {
                     const descRes = await runAws(`acm describe-certificate --certificate-arn ${cert.CertificateArn}`)
                     const details = descRes.Certificate
                     return { 
                         name: 'SSL Certificate', 
                         type: 'Certificate', 
                         id: certName, 
                         status: 'Exists', 
                         details: cert.Status,
                         metadata: {
                             DomainValidationOptions: details.DomainValidationOptions,
                             Issuer: details.Issuer,
                             Subject: details.Subject,
                             NotBefore: details.NotBefore,
                             NotAfter: details.NotAfter
                         }
                     }
                 } catch (e) {
                     console.warn('Failed to describe certificate', e)
                     return { name: 'SSL Certificate', type: 'Certificate', id: certName, status: 'Exists', details: cert.Status }
                 }
              } else {
                 return { name: 'SSL Certificate', type: 'Certificate', id: certName, status: 'Missing' }
              }
          } catch (e: any) {
              return { name: 'SSL Certificate', type: 'Certificate', id: certName, status: 'Error' }
          }
      }
  })

  // CloudFront
  const distIds = [
      { key: 'CLOUDFRONT_DISTRIBUTION_ID_API', id: config.advanced.CLOUDFRONT_DISTRIBUTION_ID_API, desc: 'API Distribution' },
      { key: 'CLOUDFRONT_DISTRIBUTION_ID_ADMIN', id: config.advanced.CLOUDFRONT_DISTRIBUTION_ID_ADMIN, desc: 'Admin Distribution' },
      { key: 'CLOUDFRONT_DISTRIBUTION_ID_PUBLIC', id: config.advanced.CLOUDFRONT_DISTRIBUTION_ID_PUBLIC, desc: 'Public Distribution' }
  ]
  distIds.forEach(d => {
      checks.push({
          type: 'CloudFront', name: d.desc, id: d.id || 'Not Configured', desc: d.desc,
          run: async () => {
              if (!d.id) return { name: d.desc, type: 'CloudFront', id: 'Not Configured', status: 'Missing' }
              try {
                  const res = await runAws(`cloudfront get-distribution --id ${d.id}`)
                  const dist = res.Distribution
                  let details = dist?.Status || 'Unknown'
                  if (dist?.DistributionConfig?.ViewerCertificate?.CloudFrontDefaultCertificate) {
                    details = 'Needs Custom Certificate'
                  }
                  
                  return { 
                      name: d.desc, 
                      type: 'CloudFront', 
                      id: d.id, 
                      status: 'Exists', 
                      details,
                      metadata: {
                          DomainName: dist.DomainName,
                          Aliases: dist.DistributionConfig?.Aliases?.Items || []
                      }
                  }
              } catch (e: any) {
                  return { name: d.desc, type: 'CloudFront', id: d.id, status: 'Missing' }
              }
          }
      })
  })

  // Emit Initial Loading State
  const initialStatus: AwsResourceStatus[] = checks.map(c => ({
      name: c.desc,
      type: c.type,
      id: c.id,
      status: 'Loading'
  }))
  win.webContents.send('aws-status-init', initialStatus)

  // Run in parallel
  await Promise.all(checks.map(async (check) => {
      const result = await check.run()
      win.webContents.send('aws-status-update', result)
  }))
}

export async function getMigrationStatus(config: AppConfig, env: 'local' | 'prod' = 'local'): Promise<MigrationStatus> {
  const apiPath = join(config.destination, config.projectName, 'api')
  try {
    const { stdout } = await execAsync(`yarn migration-status --env=${env} --yes`, { cwd: apiPath })
    const output = stdout.trim()
    
    console.log(`[getMigrationStatus] Raw output for ${env}:`, output)
    
    // Use a more robust approach to find the JSON block
    const jsonMatch = output.match(/\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}/s)
    
    if (jsonMatch) {
      try {
        const jsonStr = jsonMatch[0]
        console.log(`[getMigrationStatus] Attempting to parse JSON: ${jsonStr.substring(0, 50)}...`)
        return JSON.parse(jsonStr)
      } catch (parseErr) {
        console.error(`[getMigrationStatus] Failed to parse extracted JSON block for ${env}:`, parseErr)
        console.error("[getMigrationStatus] Extracted string:", jsonMatch[0])
      }
    }

    if (output.includes("Database is not initialized")) {
      return { initialized: false, reason: "Database is not initialized" }
    }

    console.warn(`No valid JSON found in ${env} migration status output. Full output:`, output)
    return { initialized: false, reason: "Unexpected script output (not JSON)" }
  } catch (err: any) {
    console.error(`Failed to get migration status for ${env}:`, err)
    return { 
      initialized: false, 
      reason: err.message || `Failed to execute migration status check for ${env}` 
    }
  }
}

export async function runMigrationSync(config: AppConfig, win: BrowserWindow, env: 'local' | 'prod' = 'local'): Promise<boolean> {
  const apiPath = join(config.destination, config.projectName, 'api')
  const log = (msg: string, type: 'info' | 'error' | 'success') => {
    win.webContents.send('installer-log', { message: msg, type, timestamp: new Date().toISOString() })
  }

  try {
    log(`Starting ${env} database synchronization...`, 'info')
    const { stdout } = await execAsync(`yarn migration-sync --env=${env} --yes`, { cwd: apiPath })
    stdout.split('\n').forEach(line => line.trim() && log(line.trim(), 'info'))
    log(`${env} database synchronization complete!`, 'success')
    return true
  } catch (err) {
    log(`${env} database synchronization failed: ${(err as Error).message}`, 'error')
    return false
  }
}

export async function runDbSetup(config: AppConfig, win: BrowserWindow, env: 'local' | 'prod' = 'local'): Promise<boolean> {
  const apiPath = join(config.destination, config.projectName, 'api')
  const log = (msg: string, type: 'info' | 'error' | 'success') => {
    win.webContents.send('installer-log', { message: msg, type, timestamp: new Date().toISOString() })
  }

  try {
    log(`Initializing ${env} database...`, 'info')
    const { stdout } = await execAsync(`yarn setupDb --env=${env} --yes`, { cwd: apiPath })
    stdout.split('\n').forEach(line => line.trim() && log(line.trim(), 'info'))
    log(`${env} database initialized successfully!`, 'success')
    return true
  } catch (err) {
    log(`${env} database initialization failed: ${(err as Error).message}`, 'error')
    return false
  }
}
