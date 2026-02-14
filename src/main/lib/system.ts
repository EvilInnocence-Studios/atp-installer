import { exec } from 'child_process'
import { promisify } from 'util'
import { CheckResult } from '../../shared/types'
import { homedir } from 'os'
import { join } from 'path'
import * as fs from 'fs-extra'

const execAsync = promisify(exec)

export async function getAwsProfiles(): Promise<string[]> {
  try {
    const credentialsPath = join(homedir(), '.aws', 'credentials')
    if (!await fs.pathExists(credentialsPath)) {
      return []
    }
    const content = await fs.readFile(credentialsPath, 'utf-8')
    const profiles: string[] = []
    const lines = content.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        profiles.push(trimmed.slice(1, -1))
      }
    }
    return profiles
  } catch (error) {
    console.error('Error reading AWS credentials:', error)
    return []
  }
}

export async function getAwsAccountId(profile: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(`aws sts get-caller-identity --profile ${profile} --query Account --output text`)
    return stdout.trim()
  } catch (error) {
    console.error(`Failed to fetch AWS Account ID for profile ${profile}:`, error)
    return null
  }
}

export async function saveAwsCredentials(accessKey: string, secretKey: string, region: string): Promise<void> {
  const awsDir = join(homedir(), '.aws')
  await fs.ensureDir(awsDir)

  const credentialsPath = join(awsDir, 'credentials')
  const configPath = join(awsDir, 'config')

  // Simple override/write for default profile
  // In a more complex app we might parse and update, but for an installer 
  // helping a user start from scratch, setting the [default] is usually what's expected.
  
  const credentialsContent = `[default]
aws_access_key_id = ${accessKey}
aws_secret_access_key = ${secretKey}
`
  const configContent = `[default]
region = ${region}
output = json
`

  await fs.writeFile(credentialsPath, credentialsContent)
  await fs.writeFile(configPath, configContent)
}




interface ToolDefinition {
  id: string
  name: string
  wingetId: string
  description: string
}

const TOOLS: Record<string, ToolDefinition> = {
  node: { 
    id: 'node', 
    name: 'Node.js', 
    wingetId: 'OpenJS.NodeJS.LTS', 
    description: "The engine used to run the application's code and its development tools." 
  },
  git: { 
    id: 'git', 
    name: 'Git', 
    wingetId: 'Git.Git', 
    description: "A tool for downloading and managing the application's source code files." 
  },
  yarn: { 
    id: 'yarn', 
    name: 'Yarn', 
    wingetId: 'Yarn.Yarn', 
    description: "A package manager that helps install and organize all the libraries the application needs." 
  },
  psql: { 
    id: 'psql', 
    name: 'PostgreSQL', 
    wingetId: 'PostgreSQL.PostgreSQL.16', 
    description: "A database tool used to manage your local data storage." 
  },
  aws: { 
    id: 'aws', 
    name: 'AWS CLI', 
    wingetId: 'Amazon.AWSCLI', 
    description: "A command-line tool for interacting with Amazon Web Services where your app will be deployed." 
  }
}

export async function installTool(tool: string): Promise<boolean> {
  const definition = TOOLS[tool]
  if (!definition) throw new Error(`No definition found for ${tool}`)
  const id = definition.wingetId

  try {
    let command = `winget install --id ${id} -e --source winget --accept-source-agreements --accept-package-agreements`
    
    await execAsync(command)
    return true
  } catch (error) {
    console.error(`Failed to install ${tool}:`, error)
    return false
  }
}

export async function checkTool(tool: string, command = '--version'): Promise<CheckResult> {
  const definition = TOOLS[tool]
  try {
    const { stdout } = await execAsync(`${tool} ${command}`)
    return { 
      tool, 
      name: definition.name, 
      installed: true, 
      version: stdout.trim(), 
      description: definition.description 
    }
  } catch (error) {
    return { 
      tool, 
      name: definition.name, 
      installed: false, 
      error: (error as Error).message, 
      description: definition.description 
    }
  }
}

export async function checkNode(): Promise<CheckResult> {
  return checkTool('node')
}

export async function checkGit(): Promise<CheckResult> {
  return checkTool('git')
}

export async function checkYarn(): Promise<CheckResult> {
  return checkTool('yarn')
}

export async function checkPostgres(): Promise<CheckResult> {
  const tool = 'psql'
  const definition = TOOLS[tool]
  // Try default check first
  let result = await checkTool(tool)
  if (result.installed) return result

  // If failed, check common paths
  const commonPaths = [
    'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe',
    'C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe',
    'C:\\Program Files\\PostgreSQL\\15\\bin\\psql.exe'
  ]

  for (const path of commonPaths) {
     try {
        const { stdout } = await execAsync(`"${path}" --version`)
        return { 
          tool, 
          name: definition.name, 
          installed: true, 
          version: stdout.trim(), 
          description: definition.description 
        }
     } catch {
       continue
     }
  }

  return { 
    tool, 
    name: definition.name, 
    installed: false, 
    error: 'Not found in PATH or common locations', 
    description: definition.description 
  }
}


export async function checkAWS(): Promise<CheckResult> {
  return checkTool('aws')
}

export async function checkAllPrerequisites(): Promise<CheckResult[]> {
  const results = await Promise.all([
    checkNode(),
    checkGit(),
    checkYarn(),
    checkPostgres(),
    checkAWS()
  ])
  return results
}
