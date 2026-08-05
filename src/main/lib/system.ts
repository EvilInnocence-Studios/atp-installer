import { exec } from 'child_process'
import { promisify } from 'util'
import { CheckResult } from '../../shared/types'
import { homedir } from 'os'
import { join } from 'path'
import * as fs from 'fs-extra'
import { psqlPaths } from './postgres'

const execAsync = promisify(exec)

let cachedAwsPath: string | null = null;

const awsPaths = [
  'C:\\Program Files\\Amazon\\AWSCLIV2\\aws.exe',
  'C:\\Program Files\\Amazon\\AWSCLI\\aws.exe'
];

async function getAwsPath(): Promise<string> {
  if (cachedAwsPath) return cachedAwsPath;

  try {
    await execAsync('aws --version');
    cachedAwsPath = 'aws';
    return 'aws';
  } catch {
    // Continue
  }

  for (const path of awsPaths) {
    try {
      await execAsync(`"${path}" --version`);
      cachedAwsPath = `"${path}"`;
      return cachedAwsPath;
    } catch {
      continue;
    }
  }

  throw new Error('AWS CLI not found locally.');
}

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
    const awsPath = await getAwsPath();
    const { stdout } = await execAsync(`${awsPath} sts get-caller-identity --profile ${profile} --query Account --output text`)
    return stdout.trim()
  } catch (error) {
    console.error(`Failed to fetch AWS Account ID for profile ${profile}:`, error)
    return null
  }
}

export async function getAwsProfileCredentials(profile: string): Promise<{ accessKeyId: string; secretAccessKey: string } | null> {
  try {
    const credentialsPath = join(homedir(), '.aws', 'credentials')
    if (!await fs.pathExists(credentialsPath)) {
      return null
    }
    const content = await fs.readFile(credentialsPath, 'utf-8')
    const lines = content.split('\n')
    let currentProfile: string | null = null
    let accessKeyId = ''
    let secretAccessKey = ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        currentProfile = trimmed.slice(1, -1)
        continue
      }

      if (currentProfile === profile) {
        if (trimmed.toLowerCase().startsWith('aws_access_key_id')) {
          accessKeyId = trimmed.split('=')[1].trim()
        } else if (trimmed.toLowerCase().startsWith('aws_secret_access_key')) {
          secretAccessKey = trimmed.split('=')[1].trim()
        }
      }

      if (accessKeyId && secretAccessKey) break
    }

    if (accessKeyId && secretAccessKey) {
      return { accessKeyId, secretAccessKey }
    }
    return null
  } catch (error) {
    console.error(`Error reading AWS credentials for profile ${profile}:`, error)
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
    name: 'Node.js (v22)',
    wingetId: 'OpenJS.NodeJS.22',
    description: "The engine used to run the application's code and its development tools (version 22 required)."
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
  },
  python: {
    id: 'python',
    name: 'Python 3.11',
    wingetId: 'Python.Python.3.11',
    description: "Python 3.11 is required for building native dependencies."
  },
  vcpp: {
    id: 'vcpp',
    name: 'Visual C++ Build Environment',
    wingetId: 'Microsoft.VisualStudio.2022.BuildTools',
    description: "Required for compiling native Node.js modules."
  }
}

export async function installTool(tool: string): Promise<boolean> {
  const definition = TOOLS[tool]
  if (!definition) throw new Error(`No definition found for ${tool}`)
  const id = definition.wingetId

  try {
    let command = `winget install --id ${id} -e --source winget --accept-source-agreements --accept-package-agreements`

    if (tool === 'vcpp') {
      command += ` --override "--passive --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"`
    }

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
  const result = await checkTool('node')
  if (result.installed) {
    if (!result.version?.startsWith('v22.')) {
      return {
        ...result,
        installed: false,
        error: `Requires Node 22 (found ${result.version})`
      }
    }
  }
  return result
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
  const commonPaths = psqlPaths;

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
  const tool = 'aws'
  const definition = TOOLS[tool]
  try {
    const awsPath = await getAwsPath();
    const { stdout } = await execAsync(`${awsPath} --version`)
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

export async function checkVcpp(): Promise<CheckResult> {
  const tool = 'vcpp'
  const definition = TOOLS[tool]
  try {
    const vswherePath = join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe')
    if (await fs.pathExists(vswherePath)) {
      const { stdout } = await execAsync(`"${vswherePath}" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`)
      const installedPath = stdout.trim()
      if (installedPath) {
        return {
          tool,
          name: definition.name,
          installed: true,
          version: 'Installed',
          description: definition.description
        }
      }
    }
    
    return {
      tool,
      name: definition.name,
      installed: false,
      error: 'Visual C++ Build Tools not found',
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

export async function checkPython(): Promise<CheckResult> {
  const tool = 'python'
  const definition = TOOLS[tool]
  try {
    const { stdout } = await execAsync(`py -3.11 --version`)
    const version = stdout.trim()
    return {
      tool,
      name: definition.name,
      installed: true,
      version: version,
      description: definition.description
    }
  } catch {
    try {
      const { stdout } = await execAsync(`python --version`)
      const version = stdout.trim()
      if (version.startsWith('Python 3.11')) {
         return {
           tool,
           name: definition.name,
           installed: true,
           version: version,
           description: definition.description
         }
      }
      return {
        tool,
        name: definition.name,
        installed: false,
        error: `Requires Python 3.11 (found ${version})`,
        description: definition.description
      }
    } catch {
      return {
        tool,
        name: definition.name,
        installed: false,
        error: 'Python 3.11 not found',
        description: definition.description
      }
    }
  }
}

export async function checkAllPrerequisites(): Promise<CheckResult[]> {
  const results = await Promise.all([
    checkNode(),
    checkGit(),
    checkYarn(),
    checkPostgres(),
    checkAWS(),
    checkVcpp(),
    checkPython()
  ])
  return results
}
