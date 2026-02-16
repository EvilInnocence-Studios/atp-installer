/// <reference types="vite/client" />
import { AppConfig, CheckResult, DatabaseConfig, MigrationStatus } from '../../shared/types'

export interface IElectronAPI {
  loadPreferences: () => Promise<void>
}

export interface LogMessage {
  message: string
  type: 'info' | 'error' | 'success'
  timestamp?: string
}

export interface ICustomAPI {
  checkPrerequisites: () => Promise<CheckResult[]>
  installTool: (tool: string) => Promise<boolean>
  openDirectory: () => Promise<string | null>
  getAwsProfiles: () => Promise<string[]>
  getAwsAccountId: (profile: string) => Promise<string | null>
  saveAwsCredentials: (accessKey: string, secretKey: string, region: string) => Promise<void>
  startInstall: (config: AppConfig) => void
  loadProjectConfig: (path: string) => Promise<Partial<AppConfig>>
  openExternal: (url: string) => Promise<void>
  startCheckAwsStatus: (config: AppConfig) => void
  onAwsStatusInit: (callback: (status: any[]) => void) => (() => void)
  onAwsStatusUpdate: (callback: (status: any) => void) => (() => void)



  startDeploy: (config: AppConfig, target?: 'api' | 'admin' | 'public' | 'all') => void
  onProjectConfigUpdated: (callback: (config: AppConfig) => void) => (() => void)
  onModuleSyncComplete: (callback: (success: boolean) => void) => (() => void)
  updateProjectModules: (config: AppConfig, newModules: string[]) => void
  onLog: (callback: (log: LogMessage) => void) => (() => void)
  onComplete: (callback: (success: boolean) => void) => (() => void)
  onDeployComplete: (callback: (success: boolean) => void) => (() => void)
  getMigrationStatus: (config: AppConfig, env: 'local' | 'prod') => Promise<MigrationStatus>
  runMigrationSync: (config: AppConfig, env: 'local' | 'prod') => Promise<boolean>
  runDbSetup: (config: AppConfig, env: 'local' | 'prod') => Promise<boolean>
  isDatabaseInitialized: (config: DatabaseConfig) => Promise<boolean>
  
  // Dev Controls
  devStartAll: (config: AppConfig) => Promise<boolean>
  devRestart: (config: AppConfig, target: string) => Promise<boolean>
  devStop: (target: string) => Promise<boolean>
  devGetStatus: () => Promise<Record<string, string>>
  onDevStatusUpdate: (callback: (data: { id: string, status: string }) => void) => () => void

  // CockroachDB
  listClusters: (apiKey: string) => Promise<any[]>
  createCluster: (apiKey: string, name: string) => Promise<{ id: string, name: string }>
  getClusterStatus: (apiKey: string, clusterId: string) => Promise<string>
  getConnectionInfo: (apiKey: string, clusterId: string) => Promise<Partial<DatabaseConfig>>
  listCockroachDatabases: (apiKey: string, clusterId: string) => Promise<string[]>
  createCockroachDatabase: (apiKey: string, clusterId: string, name: string) => Promise<void>
  listUsers: (apiKey: string, clusterId: string) => Promise<string[]>
  createUser: (apiKey: string, clusterId: string, name: string, password?: string) => Promise<string>
  
  // PostgreSQL
  testPostgresConnection: (config: DatabaseConfig) => Promise<boolean>
  listPostgresDatabases: (config: DatabaseConfig) => Promise<string[]>
  createPostgresDatabase: (config: DatabaseConfig, name: string) => Promise<void>
  isDatabaseEmpty: (config: DatabaseConfig) => Promise<boolean>
  wipeDatabase: (config: DatabaseConfig) => Promise<void>

  // AWS Resource Init
  ensureS3Bucket: (bucketName: string, options: any) => Promise<void>
  ensureLambdaRole: (roleName: string, options: any) => Promise<void>
  ensureCertificate: (domainName: string, options: any) => Promise<string>
  ensureCloudFrontDistribution: (apiPath: string, env: any) => Promise<void>

}


declare global {
  interface Window {
    electron: IElectronAPI
    api: ICustomAPI
  }
}
