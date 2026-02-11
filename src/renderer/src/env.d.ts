/// <reference types="vite/client" />
import { AppConfig, CheckResult } from '../../shared/types'

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
  selectDirectory: () => Promise<string | null>
  getAwsProfiles: () => Promise<string[]>
  saveAwsCredentials: (accessKey: string, secretKey: string, region: string) => Promise<void>
  startInstall: (config: AppConfig) => void



  startDeploy: (config: AppConfig) => void
  onLog: (callback: (log: LogMessage) => void) => (() => void)
  onComplete: (callback: (success: boolean) => void) => (() => void)
  onDeployComplete: (callback: (success: boolean) => void) => (() => void)

  // CockroachDB
  listClusters: (apiKey: string) => Promise<any[]>
  createCluster: (apiKey: string, name: string) => Promise<{ id: string, name: string }>
  getClusterStatus: (apiKey: string, clusterId: string) => Promise<string>
  getConnectionInfo: (apiKey: string, clusterId: string) => Promise<Partial<DatabaseConfig>>
  listCockroachDatabases: (apiKey: string, clusterId: string) => Promise<string[]>
  createCockroachDatabase: (apiKey: string, clusterId: string, name: string) => Promise<void>
  listUsers: (apiKey: string, clusterId: string) => Promise<string[]>
  createUser: (apiKey: string, clusterId: string, name: string, password?: string) => Promise<string>
  getClusterStatus: (apiKey: string, clusterId: string) => Promise<string>

  // PostgreSQL
  testPostgresConnection: (config: AppConfig['dbLocal']) => Promise<boolean>
  listPostgresDatabases: (config: AppConfig['dbLocal']) => Promise<string[]>
  createPostgresDatabase: (config: AppConfig['dbLocal'], name: string) => Promise<void>
  isDatabaseEmpty: (config: DatabaseConfig) => Promise<boolean>
  wipeDatabase: (config: DatabaseConfig) => Promise<void>

}


declare global {
  interface Window {
    electron: IElectronAPI
    api: ICustomAPI
  }
}
