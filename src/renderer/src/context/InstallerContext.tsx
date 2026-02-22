import { createContext, useContext, useState, ReactNode } from 'react'
import { AppConfig, DatabaseConfig, CheckResult } from '../../../shared/types'

export interface LogMessage {
  message: string
  type: 'info' | 'error' | 'success'
  timestamp?: string
}

const initialDbConfig: DatabaseConfig = {
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  pass: '',
  name: 'atp_local'
}

const generateRandomString = (length: number): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

const sanitizeBucketName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '-') // Replace anything not a-z, 0-9, dot, or hyphen with hyphen
    .replace(/-+/g, '-')          // Consolidate multiple hyphens
    .replace(/^-+|-+$/g, '')      // Remove leading/trailing hyphens
}

const initialConfig: AppConfig = {
  projectName: 'my-atp-app',
  destination: '',
  adminDomain: 'admin.example.com',
  publicDomain: 'www.example.com',
  apiDomain: 'api.example.com',
  mediaDomain: 'media.example.com',
  modules: ['core', 'common', 'uac', 'media'], // Defaults
  advanced: {
    SALT: generateRandomString(32),
    SECRET: generateRandomString(32),
    LAMBDA_FUNCTION_NAME: 'MyAtpAppApi',
    LAMBDA_ROLE: 'BasicLambdaExecutionRole',
    ACCOUNT: '',
    S3BUCKET: 'my-atp-app-deploy',
    S3KEY: 'api.zip',
    CERTIFICATE_NAME: '',
    AWS_BUCKET_ADMIN: '',
    AWS_BUCKET_PUBLIC: '',
    AWS_BUCKET_MEDIA: '',
    CLOUDFRONT_DISTRIBUTION_ID_API: '',
    CLOUDFRONT_DISTRIBUTION_ID_ADMIN: '',
    CLOUDFRONT_DISTRIBUTION_ID_PUBLIC: '',
    CLOUDFRONT_DISTRIBUTION_ID_MEDIA: ''
  },
  dbLocal: initialDbConfig,

  dbProd: { ...initialDbConfig, name: 'atp_prod' },
  awsProfile: 'default',
  awsRegion: 'us-east-1',
  awsAccountId: ''
}

interface UIState {
  // Prereq Page
  checks: CheckResult[]
  // Database Page
  clusters: any[]
  selectedClusterId: string | null
  dbUsers: string[]
  prodDbs: string[]
  localDbs: string[]
  isLocalConnected: boolean
  dbActiveTab: 'local' | 'prod'
}

const initialUIState: UIState = {
  checks: [],
  clusters: [],
  selectedClusterId: null,
  dbUsers: [],
  prodDbs: [],
  localDbs: [],
  isLocalConnected: false,
  dbActiveTab: 'local'
}

interface InstallerContextType {
  config: AppConfig
  setConfig: (config: AppConfig) => void
  updateConfig: (updates: Partial<AppConfig>) => void
  uiState: UIState
  updateUIState: (updates: Partial<UIState>) => void
  logs: LogMessage[]
  addLog: (log: LogMessage) => void
  clearLogs: () => void
}

const InstallerContext = createContext<InstallerContextType | undefined>(undefined)

export function InstallerProvider({ children }: { children: ReactNode }): JSX.Element {
  const [config, setConfig] = useState<AppConfig>(initialConfig)
  const [uiState, setUIState] = useState<UIState>(initialUIState)
  const [logs, setLogs] = useState<LogMessage[]>([])

  const updateUIState = (updates: Partial<UIState>): void => {
    setUIState(prev => ({ ...prev, ...updates }))
  }

  const addLog = (log: LogMessage): void => {
    setLogs(prev => [...prev, log])
  }

  const clearLogs = (): void => {
    setLogs([])
  }

  const updateConfig = (updates: Partial<AppConfig>): void => {
    setConfig((prev) => {
      const next: AppConfig = { ...prev, ...updates }
      
      // Merged fields for deep objects
      if (updates.dbLocal) next.dbLocal = { ...prev.dbLocal, ...updates.dbLocal }
      if (updates.dbProd) next.dbProd = { ...prev.dbProd, ...updates.dbProd }
      if (updates.advanced) next.advanced = { ...prev.advanced, ...updates.advanced }

      // Sync Account ID
      if (updates.awsAccountId !== undefined) {
        next.advanced.ACCOUNT = updates.awsAccountId
      } else if (updates.advanced && updates.advanced.ACCOUNT !== undefined) {
        next.awsAccountId = updates.advanced.ACCOUNT
      }

      const safeProjectName = next.projectName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
      const bucketProjectName = sanitizeBucketName(next.projectName)

      // Update derived defaults
      if (updates.projectName || updates.adminDomain || updates.publicDomain) {
         next.advanced = {
           ...next.advanced,
           LAMBDA_FUNCTION_NAME: updates.advanced?.LAMBDA_FUNCTION_NAME ?? `${next.projectName.replace(/[^a-zA-Z0-9]/g, '')}Api`,
           S3BUCKET: updates.advanced?.S3BUCKET ?? sanitizeBucketName(`${bucketProjectName}-deploy`),
           CERTIFICATE_NAME: updates.advanced?.CERTIFICATE_NAME ?? next.publicDomain,
           AWS_BUCKET_ADMIN: updates.advanced?.AWS_BUCKET_ADMIN ?? sanitizeBucketName(next.adminDomain),
           AWS_BUCKET_PUBLIC: updates.advanced?.AWS_BUCKET_PUBLIC ?? sanitizeBucketName(next.publicDomain),
           AWS_BUCKET_MEDIA: updates.advanced?.AWS_BUCKET_MEDIA ?? sanitizeBucketName(next.mediaDomain)
         }
         
         // If project name changed, force update DB names
         if (updates.projectName) {
           next.dbLocal = { ...next.dbLocal, name: safeProjectName }
           next.dbProd = { ...next.dbProd, name: safeProjectName }
         }
      }

      // Ensure name is present even if just db info was updated without a name
      if (!next.dbLocal.name) next.dbLocal.name = safeProjectName
      if (!next.dbProd.name) next.dbProd.name = safeProjectName
      
      // Safety: Never let name be 'defaultdb' for prod unless explicitly selected in a way that bypasses this.
      // Resetting it if it matches 'defaultdb' specifically fixes the regression.
      if (next.dbProd.name === 'defaultdb') next.dbProd.name = safeProjectName

       return next
    })
  }


  return (
    <InstallerContext.Provider value={{ config, setConfig, updateConfig, uiState, updateUIState, logs, addLog, clearLogs }}>
      {children}
    </InstallerContext.Provider>
  )
}

export function useInstaller(): InstallerContextType {
  const context = useContext(InstallerContext)
  if (!context) {
    throw new Error('useInstaller must be used within an InstallerProvider')
  }
  return context
}
