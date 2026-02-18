import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { AppConfig, DatabaseConfig } from '../shared/types'

// Custom APIs for renderer
const api = {
  checkPrerequisites: () => ipcRenderer.invoke('check-prerequisites'),
  installTool: (tool: string) => ipcRenderer.invoke('install-tool', tool),
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  getAwsProfiles: () => ipcRenderer.invoke('get-aws-profiles'),
  getAwsAccountId: (profile: string) => ipcRenderer.invoke('aws:getAccountId', profile),
  getAwsProfileCredentials: (profile: string) => ipcRenderer.invoke('aws:getProfileCredentials', profile),
  saveAwsCredentials: (accessKey: string, secretKey: string, region: string) => ipcRenderer.invoke('aws:saveCredentials', accessKey, secretKey, region),
  startInstall: (config: any) => ipcRenderer.send('start-install', config),
  loadProjectConfig: (path: string) => ipcRenderer.invoke('load-project-config', path),
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  startCheckAwsStatus: (config: any) => ipcRenderer.send('start-check-aws-status', config),
  onAwsStatusInit: (callback: (status: any[]) => void) => {
      const sub = (_: any, val: any) => callback(val)
      ipcRenderer.on('aws-status-init', sub)
      return () => ipcRenderer.removeListener('aws-status-init', sub)
  },
  onAwsStatusUpdate: (callback: (status: any) => void) => {
      const sub = (_: any, val: any) => callback(val)
      ipcRenderer.on('aws-status-update', sub)
      return () => ipcRenderer.removeListener('aws-status-update', sub)
  },



  startDeploy: (config: any, target?: string) => ipcRenderer.send('start-deploy', config, target),
  onLog: (callback: (log: any) => void) => {
    const subscription = (_event: any, value: any) => callback(value)
    ipcRenderer.on('install-log', subscription)
    return () => ipcRenderer.removeListener('install-log', subscription)
  },
  onComplete: (callback: (success: boolean) => void) => {
    const subscription = (_event: any, value: any) => callback(value)
    ipcRenderer.on('install-complete', subscription)
    return () => ipcRenderer.removeListener('install-complete', subscription)
  },
  onDeployComplete: (callback: (success: boolean) => void) => {
    const subscription = (_event: any, value: any) => callback(value)
    ipcRenderer.on('deploy-complete', subscription)
    return () => ipcRenderer.removeListener('deploy-complete', subscription)
  },
  updateProjectModules: (config: any, newModules: string[]) => ipcRenderer.send('update-project-modules', config, newModules),
  onProjectConfigUpdated: (callback: (config: any) => void) => {
      const sub = (_: any, val: any) => callback(val)
      ipcRenderer.on('project-config-updated', sub)
      return () => ipcRenderer.removeListener('project-config-updated', sub)
  },
  onModuleSyncComplete: (callback: (success: boolean) => void) => {
      const sub = (_: any, val: any) => callback(val)
      ipcRenderer.on('module-sync-complete', sub)
      return () => ipcRenderer.removeListener('module-sync-complete', sub)
  },
  runMigrationSync: (config: AppConfig, env: 'local' | 'prod') => ipcRenderer.invoke('run-migration-sync', config, env),
  runDbSetup: (config: AppConfig, env: 'local' | 'prod') => ipcRenderer.invoke('run-db-setup', config, env),
  getMigrationStatus: (config: AppConfig, env: 'local' | 'prod') => ipcRenderer.invoke('migration:getStatus', config, env),
  isDatabaseInitialized: (config: DatabaseConfig) => ipcRenderer.invoke('database:isInitialized', config),

  // CockroachDB
  listClusters: (apiKey: string) => ipcRenderer.invoke('cockroach:listClusters', apiKey),
  createCluster: (apiKey: string, name: string) => ipcRenderer.invoke('cockroach:createCluster', apiKey, name),
  getClusterStatus: (apiKey: string, clusterId: string) => ipcRenderer.invoke('cockroach:getClusterStatus', apiKey, clusterId),
  getConnectionInfo: (apiKey: string, clusterId: string) => ipcRenderer.invoke('cockroach:getConnectionInfo', apiKey, clusterId),
  listCockroachDatabases: (apiKey: string, clusterId: string) => ipcRenderer.invoke('cockroach:listDatabases', apiKey, clusterId),
  createCockroachDatabase: (apiKey: string, clusterId: string, name: string) => ipcRenderer.invoke('cockroach:createDatabase', apiKey, clusterId, name),
  listUsers: (apiKey: string, clusterId: string) => ipcRenderer.invoke('cockroach:listUsers', apiKey, clusterId),
  createUser: (apiKey: string, clusterId: string, name: string, password?: string) => ipcRenderer.invoke('cockroach:createUser', apiKey, clusterId, name, password),
  // PostgreSQL
  testPostgresConnection: (config: any) => ipcRenderer.invoke('postgres:testConnection', config),
  listPostgresDatabases: (config: any) => ipcRenderer.invoke('postgres:listDatabases', config),
  createPostgresDatabase: (config: any, name: string) => ipcRenderer.invoke('postgres:createDatabase', config, name),
  isDatabaseEmpty: (config: any) => ipcRenderer.invoke('database:isEmpty', config),
  wipeDatabase: (config: any) => ipcRenderer.invoke('database:wipe', config),
  
  // AWS Resource Init
  ensureS3Bucket: (bucketName: string, options: any) => ipcRenderer.invoke('aws:ensureS3Bucket', bucketName, options),
  ensureLambdaRole: (roleName: string, options: any) => ipcRenderer.invoke('aws:ensureLambdaRole', roleName, options),
  ensureCertificate: (domainName: string, options: any) => ipcRenderer.invoke('aws:ensureCertificate', domainName, options),
  ensureCloudFrontDistribution: (apiPath: string, env: any) => ipcRenderer.invoke('aws:ensureCloudFrontDistribution', apiPath, env),
  
  // Dev Controls
  devStartAll: (config: AppConfig) => ipcRenderer.invoke('dev:startAll', config),
  devRestart: (config: AppConfig, target: string) => ipcRenderer.invoke('dev:restart', config, target),
  devStop: (target: string) => ipcRenderer.invoke('dev:stop', target),
  devGetStatus: () => ipcRenderer.invoke('dev:getStatus'),
  onDevStatusUpdate: (callback: (data: { id: string, status: string }) => void) => {
    const unsub = (_event: any, data: { id: string, status: string }) => callback(data)
    ipcRenderer.on('dev:status-update', unsub)
    return () => ipcRenderer.removeListener('dev:status-update', unsub)
  }

}


// ... existing code ...
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

